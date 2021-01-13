let socket;
const initSocket = (hostname, port, playerId) => {
    socket = new WebSocket("ws://" + hostname + ":" + port);

    socket.binaryType = "arraybuffer";

    socket.onopen = () => {
        socket.send(JSON.stringify({
            type: "ready",
            id: playerId
        }));
    };

    socket.onerror = (err) => {
        console.log("ERROR");
        console.log(err);
    };

    socket.onclose = () => {
        postMessage({
            type: 'SOCKET_CLOSE'
        });
    };

    socket.onmessage = function(msg) {
        postMessage(msg.data);
    };

    return socket;
};

onmessage = (msg) => {
    if (msg.data.socketInfo) {
        socket && socket.close();
        initSocket(msg.data.socketInfo.hostname, msg.data.socketInfo.port, msg.data.socketInfo.playerId);
    } else {
        socket && socket.readyState == 1 && socket.send(msg.data);
    }
};
