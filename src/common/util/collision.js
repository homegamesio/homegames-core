const collisionHelper = (node, nodeToCheck, filter, collisions = []) => {
    const _vertices = node.node.coordinates2d;
    const _verticesToCheck = nodeToCheck.node.coordinates2d;
    let vertices;
    let verticesToCheck;
    
    // hack
    if (!_vertices[0].length) {
        vertices = [];
        verticesToCheck = [];
        for (let c = 0; c < _vertices.length; c+=2) {
            vertices.push([_vertices[c], _vertices[c+1]]);
        }
        for (let c = 0; c < _verticesToCheck.length; c+=2) {
            verticesToCheck.push([_verticesToCheck[c], _verticesToCheck[c+1]]);
        }

    } else {
        vertices = _vertices;
        verticesToCheck = _verticesToCheck;
    }
 
    // assume rectangles for now

    console.log(vertices);
    // TODO: fix perf (check bounds before filter)
    if (!filter || (filter(node) && node.node.id !== nodeToCheck.node.id)) {
        const node1LeftX = vertices[0][0];//node.node.coordinates2d[0][0];//node.pos.x;
        const node1RightX = vertices[1][0];//node.node.coordinates2d[1][0];//node.pos.x + node.size.x;
        const node2LeftX = verticesToCheck[0][0]//nodeToCheck.pos.x;
        const node2RightX = verticesToCheck[1][0];//nodeToCheck.pos.x + nodeToCheck.size.x;

        const node1TopY = vertices[0][1];//node.pos.y;
        const node1BottomY = vertices[2][1];//node.pos.y + node.size.y;
        const node2TopY = verticesToCheck[0][1];//nodeToCheck.pos.y;
        const node2BottomY = verticesToCheck[2][1];//nodeToCheck.pos.y + nodeToCheck.size.y;

        const oneToTheLeft = node2RightX < node1LeftX || node1RightX < node2LeftX;
        const oneBelow = node1TopY > node2BottomY || node2TopY > node1BottomY;
        if (!(oneToTheLeft || oneBelow)) {
            collisions.push(node);
        }
    }

   for (let child in node.node.children) {
       collisionHelper(node.node.children[child], nodeToCheck, filter, collisions);
   }

   return collisions;
};

const checkCollisions = (root, node, filter = null) => {
    return collisionHelper(root, node, filter);
}

module.exports = { checkCollisions };
