'use strict';

const ACTIONS = ['LIGHT', 'HEAVY', 'RANGED', 'BLOCK', 'DODGE', 'WAIT'];

const FEATURE_NAMES = [
    'BIAS',
    'CLOSE',
    'MID RANGE',
    'LOW STAMINA',
    'LOW POSTURE',
    'ENEMY RECOVERING',
    'NEAR WALL',
    'IDLE LONG',
    'LAST LIGHT',
    'LAST HEAVY',
    'LAST RANGED',
    'LAST BLOCK',
    'LAST DODGE',
    'REPEATING',
    'APPROACHING',
    'CIRCLING'
];

const FORMAT = 'homegames.brain';
const FORMAT_VERSION = 1;
const MODEL_ID = 'counterforge-action-softmax';
const MODEL_VERSION = 1;
const INTERFACE_ID = 'counterforge-duel-intent-v1';

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function makeMatrix(rows, columns, fill) {
    const matrix = [];
    for (let row = 0; row < rows; row += 1) {
        const values = [];
        for (let column = 0; column < columns; column += 1) values.push(fill || 0);
        matrix.push(values);
    }
    return matrix;
}

function copyMatrix(matrix) {
    return matrix.map((row) => row.slice());
}

function softmax(logits) {
    let maximum = -Infinity;
    for (const value of logits) maximum = Math.max(maximum, value);
    const values = logits.map((value) => Math.exp(clamp(value - maximum, -40, 40)));
    let total = 0;
    for (const value of values) total += value;
    if (!Number.isFinite(total) || total <= 0) return values.map(() => 1 / values.length);
    return values.map((value) => value / total);
}

function validMatrix(matrix) {
    if (!Array.isArray(matrix) || matrix.length !== ACTIONS.length) return false;
    for (const row of matrix) {
        if (!Array.isArray(row) || row.length !== FEATURE_NAMES.length) return false;
        for (const value of row) if (!Number.isFinite(value)) return false;
    }
    return true;
}

class ActionModel {
    constructor(checkpoint) {
        this.learningRate = 0.085;
        this.weightLimit = 6;
        this.weights = makeMatrix(ACTIONS.length, FEATURE_NAMES.length, 0);
        this.examples = 0;
        this.correct = 0;
        this.meanLoss = 0;
        this.actionCounts = ACTIONS.map(() => 0);
        this.lastPrediction = ACTIONS.map(() => 1 / ACTIONS.length);
        this.lastLabel = ACTIONS.indexOf('WAIT');
        this.lastLoss = 0;
        this.lastGradient = 0;
        if (checkpoint) this.load(checkpoint);
    }

    reset() {
        this.weights = makeMatrix(ACTIONS.length, FEATURE_NAMES.length, 0);
        this.examples = 0;
        this.correct = 0;
        this.meanLoss = 0;
        this.actionCounts = ACTIONS.map(() => 0);
        this.lastPrediction = ACTIONS.map(() => 1 / ACTIONS.length);
        this.lastLabel = ACTIONS.indexOf('WAIT');
        this.lastLoss = 0;
        this.lastGradient = 0;
    }

    logits(features) {
        const logits = [];
        for (let action = 0; action < ACTIONS.length; action += 1) {
            let total = 0;
            for (let feature = 0; feature < FEATURE_NAMES.length; feature += 1) {
                total += this.weights[action][feature] * features[feature];
            }
            logits.push(total);
        }
        return logits;
    }

    predict(features) {
        const probabilities = softmax(this.logits(features));
        this.lastPrediction = probabilities.slice();
        return probabilities;
    }

    train(features, label) {
        if (!Array.isArray(features) || features.length !== FEATURE_NAMES.length) return null;
        const target = clamp(Math.floor(label), 0, ACTIONS.length - 1);
        const probabilities = this.predict(features);
        let maximumGradient = 0;

        for (let action = 0; action < ACTIONS.length; action += 1) {
            const error = probabilities[action] - (action === target ? 1 : 0);
            for (let feature = 0; feature < FEATURE_NAMES.length; feature += 1) {
                const gradient = error * features[feature];
                maximumGradient = Math.max(maximumGradient, Math.abs(gradient));
                this.weights[action][feature] = clamp(
                    this.weights[action][feature] - this.learningRate * gradient,
                    -this.weightLimit,
                    this.weightLimit
                );
            }
        }

        let predicted = 0;
        for (let action = 1; action < probabilities.length; action += 1) {
            if (probabilities[action] > probabilities[predicted]) predicted = action;
        }
        const loss = -Math.log(Math.max(0.000001, probabilities[target]));
        this.examples += 1;
        if (predicted === target) this.correct += 1;
        this.meanLoss += (loss - this.meanLoss) / this.examples;
        this.actionCounts[target] += 1;
        this.lastLabel = target;
        this.lastLoss = loss;
        this.lastGradient = maximumGradient;

        return {
            probabilities,
            predicted,
            label: target,
            loss,
            maximumGradient
        };
    }

    top(probabilities, count) {
        const rows = probabilities.map((probability, index) => ({
            index,
            action: ACTIONS[index],
            probability
        }));
        rows.sort((a, b) => b.probability - a.probability);
        return rows.slice(0, count || 3);
    }

    explain(features, actionIndex, count) {
        const rows = [];
        for (let feature = 0; feature < FEATURE_NAMES.length; feature += 1) {
            const contribution = this.weights[actionIndex][feature] * features[feature];
            rows.push({
                feature,
                name: FEATURE_NAMES[feature],
                value: features[feature],
                weight: this.weights[actionIndex][feature],
                contribution
            });
        }
        rows.sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));
        return rows.slice(0, count || 4);
    }

    accuracy() {
        return this.examples > 0 ? this.correct / this.examples : 0;
    }

    mastery(wins) {
        const data = clamp(this.examples / 210, 0, 1);
        const performance = clamp((this.accuracy() - 0.2) / 0.6, 0, 1);
        const generations = clamp((wins || 0) / 7, 0, 1);
        return clamp(data * 0.34 + performance * 0.22 + generations * 0.44, 0, 1);
    }

    exportCheckpoint(name, metadata) {
        return {
            kind: FORMAT,
            formatVersion: FORMAT_VERSION,
            name: name || 'Unnamed Duel Brain',
            description: metadata && metadata.description ? metadata.description : 'A Counterforge duel-intent checkpoint.',
            model: {
                id: MODEL_ID,
                version: MODEL_VERSION,
                architecture: 'multiclass-softmax-regression'
            },
            interface: {
                id: INTERFACE_ID,
                inputs: FEATURE_NAMES.slice(),
                outputs: ACTIONS.slice()
            },
            parameters: {
                weights: copyMatrix(this.weights)
            },
            training: {
                examples: this.examples,
                correct: this.correct,
                accuracy: this.accuracy(),
                meanLoss: this.meanLoss,
                actionCounts: this.actionCounts.slice(),
                wins: metadata && Number.isFinite(metadata.wins) ? metadata.wins : 0
            },
            lineage: {
                parent: metadata && metadata.parent ? metadata.parent : null,
                sourceGame: 'counterforge-apex'
            }
        };
    }

    load(checkpoint) {
        if (!checkpoint || checkpoint.kind !== FORMAT) return false;
        if (checkpoint.formatVersion !== FORMAT_VERSION) return false;
        if (!checkpoint.model || checkpoint.model.id !== MODEL_ID || checkpoint.model.version !== MODEL_VERSION) return false;
        if (!checkpoint.interface || checkpoint.interface.id !== INTERFACE_ID) return false;
        if (!checkpoint.parameters || !validMatrix(checkpoint.parameters.weights)) return false;

        this.weights = copyMatrix(checkpoint.parameters.weights);
        const training = checkpoint.training || {};
        this.examples = Number.isFinite(training.examples) ? Math.max(0, Math.floor(training.examples)) : 0;
        this.correct = Number.isFinite(training.correct) ? clamp(Math.floor(training.correct), 0, this.examples) : 0;
        this.meanLoss = Number.isFinite(training.meanLoss) ? Math.max(0, training.meanLoss) : 0;
        this.actionCounts = Array.isArray(training.actionCounts) && training.actionCounts.length === ACTIONS.length
            ? training.actionCounts.map((value) => Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0)
            : ACTIONS.map(() => 0);
        return true;
    }
}

module.exports = {
    ActionModel,
    ACTIONS,
    FEATURE_NAMES,
    INTERFACE_ID,
    MODEL_ID,
    MODEL_VERSION
};
