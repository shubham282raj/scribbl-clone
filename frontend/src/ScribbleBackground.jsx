import React, { useEffect, useRef, useState } from "react";

const ScribbleBackground = ({ className }) => {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const scribbles = useRef([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    // Set canvas size
    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    // Scribble class
    class Scribble {
      constructor() {
        this.reset();
        this.opacity = Math.random() * 0.3 + 0.1;
        this.color = this.getRandomColor();
        this.lineWidth = Math.random() * 3 + 1;
      }

      reset() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.vx = (Math.random() - 0.5) * 4;
        this.vy = (Math.random() - 0.5) * 4;
        this.points = [{ x: this.x, y: this.y }];
        this.maxPoints = Math.random() * 30 + 20;
        this.life = 1;
        this.decay = Math.random() * 0.005 + 0.002;
      }

      getRandomColor() {
        const colors = [
          "#FF6B6B",
          "#4ECDC4",
          "#45B7D1",
          "#96CEB4",
          "#FFEAA7",
          "#DDA0DD",
          "#98D8C8",
          "#F7DC6F",
          "#BB8FCE",
          "#85C1E9",
          "#F8C471",
          "#82E0AA",
        ];
        return colors[Math.floor(Math.random() * colors.length)];
      }

      update() {
        // Add slight randomness to velocity
        this.vx += (Math.random() - 0.5) * 0.5;
        this.vy += (Math.random() - 0.5) * 0.5;

        // Limit velocity
        this.vx = Math.max(-3, Math.min(3, this.vx));
        this.vy = Math.max(-3, Math.min(3, this.vy));

        // Update position
        this.x += this.vx;
        this.y += this.vy;

        // Add new point
        this.points.push({ x: this.x, y: this.y });

        // Remove old points
        if (this.points.length > this.maxPoints) {
          this.points.shift();
        }

        // Decrease life
        this.life -= this.decay;

        // Bounce off edges
        if (this.x < 0 || this.x > canvas.width) {
          this.vx *= -1;
          this.x = Math.max(0, Math.min(canvas.width, this.x));
        }
        if (this.y < 0 || this.y > canvas.height) {
          this.vy *= -1;
          this.y = Math.max(0, Math.min(canvas.height, this.y));
        }

        // Reset if life is over
        if (this.life <= 0) {
          this.reset();
          this.color = this.getRandomColor();
          this.lineWidth = Math.random() * 3 + 1;
        }
      }

      draw(ctx) {
        if (this.points.length < 2) return;

        ctx.save();
        ctx.globalAlpha = this.opacity * this.life;
        ctx.strokeStyle = this.color;
        ctx.lineWidth = this.lineWidth;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";

        ctx.beginPath();
        ctx.moveTo(this.points[0].x, this.points[0].y);

        // Draw smooth curve through points
        for (let i = 1; i < this.points.length - 1; i++) {
          const current = this.points[i];
          const next = this.points[i + 1];
          const cpx = (current.x + next.x) / 2;
          const cpy = (current.y + next.y) / 2;
          ctx.quadraticCurveTo(current.x, current.y, cpx, cpy);
        }

        // Draw to last point
        if (this.points.length > 1) {
          const lastPoint = this.points[this.points.length - 1];
          ctx.lineTo(lastPoint.x, lastPoint.y);
        }

        ctx.stroke();
        ctx.restore();
      }
    }

    // Initialize scribbles
    const initScribbles = () => {
      scribbles.current = [];
      for (let i = 0; i < 8; i++) {
        scribbles.current.push(new Scribble());
      }
    };

    initScribbles();

    // Animation loop
    const animate = () => {
      // Clear canvas with slight trail effect
      ctx.fillStyle = "rgba(10, 10, 20, 0.05)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Update and draw scribbles
      scribbles.current.forEach((scribble) => {
        scribble.update();
        scribble.draw(ctx);
      });

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener("resize", resizeCanvas);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  return (
    <div
      className={
        "fixed -z-50 top-0 transition-all duration-1000 left-0 w-screen h-screen overflow-hidden bg-gradient-to-br from-slate-900 via-black to-slate-800 " +
        className
      }
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        style={{ mixBlendMode: "screen" }}
      />

      {/* Content overlay
      <div className="relative z-10 flex items-center justify-center h-full">
        <div className="text-center text-white p-8 backdrop-blur-sm bg-black/20 rounded-xl border border-white/10">
          <h1 className="text-4xl font-bold mb-4 text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-blue-400">
            Scribble Background
          </h1>
          <p className="text-lg opacity-80">
            Random lines drawing and fading continuously
          </p>
        </div>
      </div> */}
    </div>
  );
};

export default ScribbleBackground;
