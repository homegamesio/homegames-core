const collisionHelper = (node, nodeToCheck, filter, collisions = []) => {
    if (!filter || (filter(node) && node.id !== nodeToCheck.id)) {
        const node1LeftX = node.pos.x;
        const node1RightX = node.pos.x + node.size.x;
        const node2LeftX = nodeToCheck.pos.x;
        const node2RightX = nodeToCheck.pos.x + nodeToCheck.size.x;

        const node1TopY = node.pos.y;
        const node1BottomY = node.pos.y + node.size.y;
        const node2TopY = nodeToCheck.pos.y;
        const node2BottomY = nodeToCheck.pos.y + nodeToCheck.size.y;

        const oneToTheLeft = node2RightX < node1LeftX || node1RightX < node2LeftX;
        const oneBelow = node1TopY > node2BottomY || node2TopY > node1BottomY;
        if (!(oneToTheLeft || oneBelow)) {
            collisions.push(node);
        }
    }

   for (let child in node.children) {
       collisionHelper(node.children[child], nodeToCheck, filter, collisions);
   }

   return collisions;
};

const wouldCollide = (root, node, filter = null) => {
    return collisionHelper(root, node, filter);
}

module.exports = { wouldCollide };
