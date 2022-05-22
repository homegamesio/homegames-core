const { Game, ViewableGame, GameNode, Colors, ShapeUtils, Shapes, squish, unsquish, ViewUtils } = require('squish-0730');

const { COLORS } = Colors;

const BASE_COLOR = [251, 255, 242, 255];
const SEARCH_BOX_COLOR = [241, 112, 111, 255];
const SEARCH_TEXT_COLOR = COLORS.ALMOST_BLACK;//[255, 255, 255, 255];

const renderDashboard = ({ playerId, playerQuery, plane, playerView }) => {
    console.log('eennenenene ' + playerId);
    const playerNodeRoot = new GameNode.Shape({
        shapeType: Shapes.POLYGON,
        coordinates2d: ShapeUtils.rectangle(0, 0, 0, 0),
        playerIds: [playerId]
    });

    const gameContainerHeight = 20;
    const gameContainerYMargin = 2;

    // playerGameViewRoot.addChild(view);


    // let view;
    // if (results) {
    //     const plane = this.initializeCollectionPlane(results.games);
    //     view = ViewUtils.getView(
    //         plane,
    //         playerView, 
    //         [playerId], 
    //         {
    //             filter: (node) => node.node.id !== plane.getChildren()[0].node.id, 
    //             y: (100 - containerHeight)
    //         }
    //     );
    //     // return;
    // } else {
    //     view = ViewUtils.getView(
    //         this.getPlane(),
    //         playerView, 
    //         [playerId], 
    //         {
    //             filter: (node) => node.node.id !== this.base.node.id, 
    //             y: (100 - containerHeight)
    //         }
    //     );
    // }

    // playerGameViewRoot.addChild(view);

    const playerSearchBox = new GameNode.Shape({
        shapeType: Shapes.POLYGON, 
        coordinates2d: ShapeUtils.rectangle(12.5, 2.5, 75, 10),
        playerIds: [playerId],
        fill: SEARCH_BOX_COLOR
    });

    const playerSearchText = new GameNode.Text({
        textInfo: {
            x: 15, // maybe need a function to map text size given a screen size
            y: 5.5,
            text: 'ayo',//query || 'Search - coming soon',
            color: SEARCH_TEXT_COLOR,
            size:1.8
        },
        playerIds: [playerId]
    });

    playerSearchBox.addChild(playerSearchText);

    let canGoDown, canGoUp = false;

    const baseHeight = 10000;//this.base.node.coordinates2d[2][1];

    const currentView = playerView;//this.playerViews[playerId].view;
    console.log('currnrenre');
    if (currentView.y - (gameContainerHeight + gameContainerYMargin) >= 0) {     
        canGoUp = true;
    } 
        
    if (currentView.y + 2 * (gameContainerHeight + gameContainerYMargin) <= baseHeight) {
        canGoDown = true;
    }
    const upArrow = new GameNode.Shape({
        shapeType: Shapes.POLYGON,
        coordinates2d: ShapeUtils.rectangle(90, 22.5, 10, 20),
        playerIds: [playerId],
        fill: BASE_COLOR,
        onClick: (player, x, y) => {

            // const _plane = results ? this.initializeCollectionPlane(results.games) : this.getPlane();

            // const currentView = Object.assign({}, this.playerViews[playerId].view);

            // if (currentView.y - (gameContainerHeight + gameContainerYMargin) >= 0) {
            //     currentView.y -= gameContainerHeight + gameContainerYMargin;
            //     this.playerViews[playerId].view = currentView;
            //     this.renderGames(playerId, {});
            // } 
        }
    });

    const upText = new GameNode.Text({
        textInfo: {
            x: 95,
            y: 27.5,
            align: 'center',
            size: 1.1,
            text: '\u25B2',
            color: COLORS.BLACK
        }
    });

    upArrow.addChild(upText);

    const downArrow = new GameNode.Shape({
        shapeType: Shapes.POLYGON,
        coordinates2d: ShapeUtils.rectangle(90, 72.5, 10, 20),
        playerIds: [playerId],
        fill: BASE_COLOR,
        onClick: (player, x, y) => {
            const _plane = results ? this.initializeCollectionPlane(results.games) : this.getPlane();

            const currentView = Object.assign({}, this.playerViews[playerId].view);

            // y value of bottom right corner of base (assumed rectangle)
            const baseHeight = 10000;//this.base.node.coordinates2d[2][1];

            // game container height + game y margin would be the new 0, 0 of the view, so we multiply by 2 to make sure the new view would be covered by the base
            if (currentView.y + 2 * (gameContainerHeight + gameContainerYMargin) <= baseHeight) {
                currentView.y += gameContainerHeight + gameContainerYMargin;
                this.playerViews[playerId].view = currentView;
                this.renderGames(playerId, {});
            } 

        }
    });

    const downText = new GameNode.Text({
        textInfo: {
            x: 95,
            y: 77.5,
            align: 'center',
            size: 1.1,
            text: '\u25BC',
            color: COLORS.BLACK
        }
    });

    downArrow.addChild(downText);


    // playerNodeRoot.addChild(playerGameViewRoot);
    playerNodeRoot.addChild(playerSearchBox);
    if (canGoUp) {
        playerNodeRoot.addChildren(upArrow);
    }
    if (canGoDown) {
        playerNodeRoot.addChildren(downArrow);
    }

    return playerNodeRoot;
};

module.exports = {	
    renderDashboard
};