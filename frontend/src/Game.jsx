// Game.jsx
import { useRef, useState, useEffect } from "react";
import io from "socket.io-client";
import { Pen, Undo, Trash, TimerIcon, SendHorizonal } from "lucide-react";
import toast from "react-hot-toast";
import { HexColorPicker } from "react-colorful";

export default function Game({ username }) {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [context, setContext] = useState(null);
  const [socket, setSocket] = useState(null);

  const [penColor, setPenColor] = useState("white");
  const [penWidth, setPenWidth] = useState(4);

  const [players, setPlayers] = useState([]);
  const [currPlayer, setCurrPlayer] = useState(null);
  const [currWord, setCurrWord] = useState(null);

  const [chats, setChats] = useState([]);

  const [chatsEnabled, setChatsEnabled] = useState(true);

  const [timer, setTimer] = useState(0);

  const historyRef = useRef([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    // canvas.width = 1200;
    canvas.width = 900;
    canvas.height = 700;
    const ctx = canvas.getContext("2d");
    ctx.lineCap = "round";
    setContext(ctx);

    historyRef.current.push(canvas.toDataURL());
  }, []);

  // Draw from remote
  useEffect(() => {
    if (!context) return;

    // Connect to the backend
    const socket = io("http://localhost:6968", {
      auth: {
        username: username,
      },
    });

    if (socket.connected)
      toast.success(`Connected successfully as ${username}`);

    setSocket(socket);

    socket.on("draw", onCanvasDraw);
    socket.on("clear", onCanvasClear);
    socket.on("undo", onCanvasUndo);
    socket.on("players", setServerPlayers);
    socket.on("currPlayer", (data) => {
      setIsDrawing(data == username);
      setCurrPlayer(data);
    });
    socket.on("currWord", (data) => setCurrWord(data));
    socket.on("duplicate-username", () => {
      toast.error("User with the same username is already in the game");
    });
    socket.on("chat", onChat);
    socket.on("clearChat", () => {
      setChats((prev) => []);
    });
    socket.on("message", (data) => toast(data));
    socket.on("disableChats", (data) => {
      setChatsEnabled(!data);
    });
    socket.on("time", (data) => {
      setTimer(data);
    });

    return () => {
      socket.disconnect();
    };
  }, [context]);

  const setServerPlayers = (data) => {
    setPlayers(data);
  };

  const onChat = (data) => {
    setChats((prev) => [...prev, ...data]);
  };

  const onCanvasUndo = () => {
    console.log(historyRef.current.length);
    historyRef.current.pop();
    const history = historyRef.current;
    const prevImg = history[history.length - 1];

    const img = new Image();
    img.src = prevImg;
    img.onload = () => {
      context.clearRect(
        0,
        0,
        canvasRef.current.width,
        canvasRef.current.height
      );
      context.drawImage(img, 0, 0);
    };
  };

  const onCanvasClear = () => {
    context.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    historyRef.current.length = 0;
    historyRef.current.push(canvasRef.current.toDataURL());
  };

  const onCanvasDraw = (data) => {
    const { x, y, strokeColor, strokeWidth, event } = data;

    if (event == "pendown") {
      context.closePath();
      context.beginPath();
      context.strokeStyle = strokeColor;
      context.lineWidth = strokeWidth;
      context.moveTo(x, y);
    } else if (event == "penup") {
      const snapshot = canvasRef.current.toDataURL();
      historyRef.current.push(snapshot);
    } else if (event == "draw") {
      context.lineTo(x, y);
      context.stroke();
    }
  };

  const startDrawing = (e) => {
    const x = e.nativeEvent.offsetX;
    const y = e.nativeEvent.offsetY;

    setIsDrawing(true);
    socket.emit("draw", {
      event: "pendown",
      x,
      y,
      strokeColor: penColor,
      strokeWidth: penWidth,
    });
  };

  const draw = (e) => {
    if (!isDrawing) return;
    const x = e.nativeEvent.offsetX;
    const y = e.nativeEvent.offsetY;
    socket.emit("draw", { x, y, event: "draw" });
  };

  const stopDrawing = () => {
    socket.emit("draw", { event: "penup" });
    setIsDrawing(false);
  };

  const onMouseLeave = () => {
    if (isDrawing) {
      socket.emit("draw", { event: "penup" });
      setIsDrawing(false);
    }
  };

  const buttons = [
    {
      name: "Undo",
      onClick: () => {
        socket.emit("undo");
      },
      icon: Undo,
    },
    {
      name: "Clear",
      onClick: () => {
        socket.emit("clear");
      },
      icon: Trash,
    },
  ];

  const brushSizes = [
    { size: 1 },
    { size: 2 },
    { size: 4 },
    { size: 6 },
    { size: 8 },
  ];

  const drawingEnabled = username == currPlayer ? true : null;

  return (
    <div className="text-white flex mx-auto flex-col w-fit">
      <div className="flex justify-between bg-white/10 px-5 py-5 rounded-lg my-3 text-3xl">
        <div style={{ color: "white" }} className="font-bold">
          skribbl.clone
        </div>
        <div className="flex items-center gap-2">
          {username}{" "}
          {socket && socket.connected && (
            <div className="w-3 h-3 bg-green-600 rounded-full"></div>
          )}
        </div>
      </div>

      <div className=" p-2">
        <div className="flex gap-2">
          <div className="flex-1 max-h-fit">
            <CanvasHeader
              timer={timer}
              currPlayer={currPlayer}
              drawingEnabled={drawingEnabled}
              currWord={currWord}
            />
            <canvas
              ref={canvasRef}
              className={`bg-neutral-900 rounded-lg ${
                drawingEnabled ? "cursor-crosshair" : ""
              }`}
              onMouseDown={drawingEnabled && startDrawing}
              onMouseMove={drawingEnabled && draw}
              onMouseUp={drawingEnabled && stopDrawing}
              onMouseLeave={drawingEnabled && onMouseLeave}
            />
          </div>
          <div className="flex gap-2 flex-1 flex-col-reverse justify-end py-2">
            <AllPlayers players={players} currPlayer={currPlayer} />
            <ChatsComponent
              chatsEnabled={chatsEnabled}
              setChatsEnabled={setChatsEnabled}
              chats={chats}
              sendChat={(message) => {
                socket.emit("chat", {
                  username,
                  message,
                });
              }}
            />
          </div>
        </div>
      </div>

      {drawingEnabled && (
        <div className="flex gap-10 justify-center py-3">
          <div className="relative w-fit flex items-center gap-3">
            <div>Pen Color:</div>
            <div className="group">
              <button
                key={penColor}
                title={penColor}
                className="w-10 h-10 cursor-pointer border rounded-lg"
                style={{ backgroundColor: penColor }}
              ></button>
              <div className="group-hover:block hidden absolute bottom-1 pb-14 left-0">
                <HexColorPicker color={penColor} onChange={setPenColor} />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="text-white">Pen Size: </div>
            {brushSizes.map((brushSize) => (
              <button
                key={brushSize.size}
                className=" cursor-pointer flex justify-center items-center"
                onClick={() => {
                  setPenWidth(brushSize.size);
                }}
              >
                <div
                  title={`Pen Size: ${brushSize.size}`}
                  className={` border border-white rounded-full`}
                  style={{
                    backgroundColor:
                      brushSize.size === penWidth ? penColor : "white",
                    width: `${(brushSize.size * 1 + 3) * 3}px`,
                    height: `${(brushSize.size * 1 + 3) * 3}px`,
                  }}
                ></div>
              </button>
            ))}
          </div>

          {buttons.map((button) => (
            <button
              key={button.name}
              title={button.name}
              className="bg-white/10 tracking-wider font-medium px-4 py-2 rounded-2xl cursor-pointer"
              onClick={button.onClick}
            >
              {/* {button.name} */}
              <button.icon />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ChatsComponent({ chats, sendChat, chatsEnabled }) {
  const [textBox, setTextBox] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    if (chatsEnabled) inputRef.current.focus();
  }, [chatsEnabled]);

  return (
    <div className="bg-white/10 w-96 flex flex-col rounded-lg overflow-hidden">
      <form
        className="flex flex-row justify-between border-b border-gray-900 text-lg"
        onSubmit={(e) => {
          e.preventDefault();
          if (!textBox) return;
          sendChat(textBox);
          setTextBox("");
        }}
      >
        <input
          disabled={!chatsEnabled}
          ref={inputRef}
          type="text"
          name="password"
          className={`w-full outline-none py-3 px-3 disabled:opacity-50 disabled:cursor-not-allowed`}
          placeholder="Type here"
          autoComplete="new-password"
          value={textBox}
          onChange={(e) => setTextBox(e.target.value)}
        />
        <button
          className="w-fit px-3 py-1 cursor-pointer font-medium disabled:cursor-not-allowed bg-white/10"
          type="submit"
          disabled={!chatsEnabled}
        >
          <SendHorizonal />
        </button>
      </form>
      <div className="px-3 py-2">
        <div className="flex flex-col gap-1 overflow-y-scroll hide-scrollbar max-h-80 select-none">
          <table className="">
            <tbody className="">
              {chats
                .map((chat, index) => (
                  <tr
                    key={index}
                    className={`align-top`}
                    style={{ color: chat.color }}
                  >
                    <td>{chat.username}</td>
                    <td className="pl-4">{chat.message}</td>
                  </tr>
                ))
                .reverse()}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function AllPlayers({ players, currPlayer }) {
  return (
    <div className="bg-white/10 rounded-lg py-2 px-6 w-full mx-auto">
      <div className="flex justify-between text-lg font-medium">
        <span>
          Players Online ({players.filter((player) => player.connected).length})
        </span>
        {/* <span>Total Players ({players.length})</span> */}
      </div>
      <div className="border-t border-gray-500 my-1"></div>
      <div className="px-5">
        {players
          .slice()
          .filter((player) => player.connected)
          .sort((a, b) => {
            if (a.connected !== b.connected) {
              return b.connected - a.connected;
            }
            return b.score - a.score;
          })
          .map((player) => (
            <div
              key={player.username}
              style={{ color: player.gussedCorrect && "green" }}
              className={`flex justify-between ${
                !player.connected && "opacity-40"
              }`}
            >
              <div>
                {player.username}
                {player.username == currPlayer && (
                  <Pen className="inline h-5 mx-3" />
                )}
              </div>
              <div>{Math.round(player.score)}</div>
            </div>
          ))}
      </div>
    </div>
  );
}

function CanvasHeader({ timer, currPlayer, drawingEnabled, currWord }) {
  return (
    <div className="flex justify-between text-2xl font-medium  py-2 px-2">
      <div>
        {drawingEnabled ? "You are drawing" : `${currPlayer} is drawing`}
      </div>
      <div className="flex justify-center items-center gap-3">
        <TimerIcon size={40} /> {timer.maxTime - timer.timer}
      </div>
      <div>
        {drawingEnabled ? "Your word" : "Word to guess"}:{" "}
        {currWord && (
          <div
            className={`inline-flex ml-3 ${
              drawingEnabled
                ? "gap-1 blur-sm hover:blur-none transition-all duration-200 cursor-pointer"
                : "gap-2"
            }`}
          >
            {currWord.split("").map((char, index) => (
              <span
                key={"word-to-guess-" + index}
                className={`capitalize font-bold ${char == " " && "mx-1.5"}`}
              >
                {char}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
