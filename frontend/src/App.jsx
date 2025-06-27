import { useEffect, useRef, useState } from "react";
import Game from "./Game";
import { Toaster, toast } from "react-hot-toast";
import { SendHorizonal } from "lucide-react";
import ScribbleBackground from "./ScribbleBackground";

export default function App() {
  const [username, setUsername] = useState();

  const [toggleBg, setToggleBg] = useState(true);

  return (
    <div className="relative">
      {toggleBg && <ScribbleBackground className={username && "blur-xs"} />}
      <ToggleButton toggle={toggleBg} setToggle={setToggleBg} />

      {username ? (
        <Game username={username} />
      ) : (
        <InitPage setUsername={setUsername} />
      )}
      <Toaster />
    </div>
  );
}

function InitPage({ setUsername }) {
  const [textbox, setTextbox] = useState("");
  const textboxRef = useRef(null);
  const maxLength = 10;

  const handleSubmit = () => {
    // setTextbox((textbox) => {
    if (textbox) {
      localStorage.setItem("username", textbox);
      setUsername(textbox);
    } else {
      toast("enter your username", {
        style: {
          backgroundColor: "transparent",
          color: "white",
        },
      });
    }
    //   return textbox;
    // });
  };

  useEffect(() => {
    const lastUsername = localStorage.getItem("username");
    if (lastUsername) {
      setTextbox(lastUsername.slice(0, maxLength));
    }

    const focusTextBox = () => {
      textboxRef.current.focus();
    };

    focusTextBox();

    textboxRef.current.addEventListener("blur", focusTextBox);

    return () => {
      textboxRef.current?.removeEventListener("blur", focusTextBox);
    };
  }, []);

  return (
    <div className="text-white flex flex-col gap-20 h-screen w-screen justify-center items-center select-none">
      <Title />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmit();
        }}
        className="flex flex-row items-center justify-center gap-2 text-lg"
      >
        <input
          type="text"
          ref={textboxRef}
          value={textbox}
          onChange={(e) => setTextbox(e.target.value.slice(0, maxLength))}
          className="w-0 h-0 outline-0 opacity-0"
        />
        <div className={`${!textbox && ""}`}>{textbox || ""}</div>
        <button type="submit" className="outline-none translate-y-0.5">
          <SendHorizonal />
        </button>
      </form>
    </div>
  );
}

function Title() {
  const text = "skribbl.clone";
  const [time, setTime] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setTime((prev) => prev + 0.1);
    }, 50);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="font-cabin-sketch flex text-8xl select-none">
      {text.split("").map((char, idx) => {
        // Create a wave effect using sine function
        const waveOffset = Math.sin(time + idx * 0.5) * 8;
        const secondaryWave = Math.sin(time * 1.5 + idx * 0.3) * 6;
        const totalOffset = waveOffset + secondaryWave;

        return (
          <div
            key={idx}
            className="transition-all duration-75 ease-out text-white drop-shadow-lg"
            style={{
              transform: `translateY(${totalOffset}px)`,
              textShadow: "0 0 20px rgba(255,255,255,0.5)",
            }}
          >
            {char === "." ? <span className="text-yellow-400">.</span> : char}
          </div>
        );
      })}
    </div>
  );
}

function ToggleButton({ toggle, setToggle }) {
  return (
    <div className="text-white fixed right-0 bottom-0 m-4 flex justify-center items-center gap-2">
      <span>Background</span>
      <button
        className="bg-white/30 rounded-full w-14 p-1.5 cursor-pointer"
        onClick={() => setToggle((v) => !v)}
      >
        <div
          className={`w-1/2 aspect-square rounded-full bg-white transform transition-transform duration-300 ${
            toggle ? "translate-x-full" : ""
          }`}
        ></div>
      </button>
    </div>
  );
}
