const collisionHelper = (node, nodeToCheck, filter, collisions = []) => {
    // assume rectangles for now


    // TODO: fix perf (check bounds before filter)
    if (!filter || (filter(node) && node.node.id !== nodeToCheck.node.id)) {
        const node1LeftX = node.node.coordinates2d[0][0];//node.pos.x;
        const node1RightX = node.node.coordinates2d[1][0];//node.pos.x + node.size.x;
        const node2LeftX = nodeToCheck.node.coordinates2d[0][0]//nodeToCheck.pos.x;
        const node2RightX = nodeToCheck.node.coordinates2d[1][0];//nodeToCheck.pos.x + nodeToCheck.size.x;

        const node1TopY = node.node.coordinates2d[0][1];//node.pos.y;
        const node1BottomY = node.node.coordinates2d[2][1];//node.pos.y + node.size.y;
        const node2TopY = nodeToCheck.node.coordinates2d[0][1];//nodeToCheck.pos.y;
        const node2BottomY = nodeToCheck.node.coordinates2d[2][1];//nodeToCheck.pos.y + nodeToCheck.size.y;

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
