const listenable = function(obj, onChange) {
    const handler = {
        get(target, property, receiver) {
            return Reflect.get(target, property, receiver);
        },
        defineProperty(target, property, descriptor) {
            onChange && onChange();
            return Reflect.defineProperty(target, property, descriptor);
        },
        deleteProperty(target, property) {
            onChange && onChange();
            return Reflect.deleteProperty(target, property);
        }
    };

    return new Proxy(obj, handler);
};


module.exports = {
    listenable
};
