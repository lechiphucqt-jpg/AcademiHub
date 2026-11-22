import React, { useEffect, useRef, useState } from 'react';
import {
  Activity,
  Compass,
  Maximize2,
  Minimize2,
  Orbit,
  Pause,
  Play,
  RotateCcw,
  Sliders,
  Sparkles,
  Waveform,
} from 'lucide-react';

interface StemSimulationLabProps {
  initialType?: 'physics-projectile' | 'physics-pendulum' | 'math-fractal' | 'math-waves';
  onNotify?: (message: string, tone?: 'success' | 'error' | 'info') => void;
}

type SimulationMode =
  | 'physics-projectile'
  | 'physics-pendulum'
  | 'math-fractal'
  | 'math-waves';

export default function StemSimulationLab({
  initialType = 'physics-projectile',
  onNotify,
}: StemSimulationLabProps) {
  const [activeSim, setActiveSim] = useState<SimulationMode>(initialType);
  const [isRunning, setIsRunning] = useState(true);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Projectile state
  const [velocity, setVelocity] = useState(25); // m/s
  const [angleDeg, setAngleDeg] = useState(45); // degrees
  const [gravity, setGravity] = useState(9.8); // m/s^2
  const [projTime, setProjTime] = useState(0);

  // Pendulum state
  const [length, setLength] = useState(150); // px
  const [initialAngle, setInitialAngle] = useState(45); // deg
  const [damping, setDamping] = useState(0.998);
  const pendulumAngleRef = useRef((45 * Math.PI) / 180);
  const pendulumVelRef = useRef(0);

  // Fractal Tree state
  const [treeDepth, setTreeDepth] = useState(8);
  const [branchAngle, setBranchAngle] = useState(28); // deg
  const [lengthRatio, setLengthRatio] = useState(0.72);
  const [windSway, setWindSway] = useState(0);

  // Wave Interference state
  const [frequency, setFrequency] = useState(2); // Hz
  const [sourceDist, setSourceDist] = useState(120); // px

  // Calculated values for Projectile
  const angleRad = (angleDeg * Math.PI) / 180;
  const maxTime = (2 * velocity * Math.sin(angleRad)) / gravity;
  const maxHeight = Math.pow(velocity * Math.sin(angleRad), 2) / (2 * gravity);
  const maxRange = (Math.pow(velocity, 2) * Math.sin(2 * angleRad)) / gravity;

  // Projectile Animation Loop
  useEffect(() => {
    if (activeSim !== 'physics-projectile') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      // Grid background
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 1;
      for (let x = 0; x < width; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Ground line
      const groundY = height - 50;
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, groundY);
      ctx.lineTo(width, groundY);
      ctx.stroke();

      // Trajectory curve
      const scaleX = (width - 100) / Math.max(maxRange, 10);
      const scaleY = (height - 120) / Math.max(maxHeight, 5);
      const startX = 50;

      ctx.beginPath();
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 2.5;
      ctx.setLineDash([4, 4]);

      const steps = 100;
      for (let i = 0; i <= steps; i++) {
        const t = (i / steps) * maxTime;
        const x = startX + velocity * Math.cos(angleRad) * t * scaleX;
        const y = groundY - (velocity * Math.sin(angleRad) * t - 0.5 * gravity * t * t) * scaleY;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.setLineDash([]);

      // Current projectile position
      if (isRunning) {
        setProjTime((prev) => {
          const next = prev + 0.03;
          return next > maxTime ? 0 : next;
        });
      }

      const curX = startX + velocity * Math.cos(angleRad) * projTime * scaleX;
      const curY = groundY - (velocity * Math.sin(angleRad) * projTime - 0.5 * gravity * projTime * projTime) * scaleY;

      // Projectile ball
      ctx.beginPath();
      ctx.arc(curX, curY, 8, 0, 2 * Math.PI);
      ctx.fillStyle = '#ef4444';
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Launch Cannon
      ctx.save();
      ctx.translate(startX, groundY);
      ctx.rotate(-angleRad);
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(0, -6, 30, 12);
      ctx.restore();

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [activeSim, velocity, angleDeg, gravity, isRunning, projTime, maxRange, maxHeight, maxTime]);

  // Pendulum Animation Loop
  useEffect(() => {
    if (activeSim !== 'physics-pendulum') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      const pivotX = width / 2;
      const pivotY = 60;

      if (isRunning) {
        // Physics integration
        const g = 0.4;
        const angularAccel = (-g / length) * Math.sin(pendulumAngleRef.current);
        pendulumVelRef.current += angularAccel;
        pendulumVelRef.current *= damping;
        pendulumAngleRef.current += pendulumVelRef.current;
      }

      const bobX = pivotX + length * Math.sin(pendulumAngleRef.current);
      const bobY = pivotY + length * Math.cos(pendulumAngleRef.current);

      // Rod
      ctx.beginPath();
      ctx.moveTo(pivotX, pivotY);
      ctx.lineTo(bobX, bobY);
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 3;
      ctx.stroke();

      // Pivot
      ctx.beginPath();
      ctx.arc(pivotX, pivotY, 6, 0, 2 * Math.PI);
      ctx.fillStyle = '#0f172a';
      ctx.fill();

      // Bob
      ctx.beginPath();
      ctx.arc(bobX, bobY, 18, 0, 2 * Math.PI);
      ctx.fillStyle = '#2563eb';
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [activeSim, length, damping, isRunning]);

  // Fractal Tree Render
  useEffect(() => {
    if (activeSim !== 'math-fractal') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    const startX = width / 2;
    const startY = height - 30;
    const trunkLength = 90;

    const drawBranch = (x: number, y: number, len: number, angle: number, depth: number) => {
      if (depth === 0) return;

      const rad = (angle * Math.PI) / 180;
      const nextX = x + len * Math.sin(rad);
      const nextY = y - len * Math.cos(rad);

      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(nextX, nextY);
      ctx.lineWidth = Math.max(1, depth * 1.2);
      ctx.strokeStyle = depth > 2 ? '#475569' : '#10b981';
      ctx.stroke();

      const spread = branchAngle;
      drawBranch(nextX, nextY, len * lengthRatio, angle - spread + windSway, depth - 1);
      drawBranch(nextX, nextY, len * lengthRatio, angle + spread + windSway, depth - 1);
    };

    drawBranch(startX, startY, trunkLength, 0, treeDepth);
  }, [activeSim, treeDepth, branchAngle, lengthRatio, windSway]);

  // Wave Interference Loop
  useEffect(() => {
    if (activeSim !== 'math-waves') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let t = 0;

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      const s1X = width / 2 - sourceDist / 2;
      const s1Y = height / 2;
      const s2X = width / 2 + sourceDist / 2;
      const s2Y = height / 2;

      // Draw concentric wave circles
      const wavelength = 30 / frequency;
      const maxR = Math.max(width, height);

      for (let r = (t * 2) % wavelength; r < maxR; r += wavelength) {
        ctx.beginPath();
        ctx.arc(s1X, s1Y, r, 0, 2 * Math.PI);
        ctx.strokeStyle = 'rgba(59, 130, 246, 0.25)';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(s2X, s2Y, r, 0, 2 * Math.PI);
        ctx.strokeStyle = 'rgba(16, 185, 129, 0.25)';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Draw sources
      ctx.fillStyle = '#2563eb';
      ctx.beginPath();
      ctx.arc(s1X, s1Y, 7, 0, 2 * Math.PI);
      ctx.fill();

      ctx.fillStyle = '#059669';
      ctx.beginPath();
      ctx.arc(s2X, s2Y, 7, 0, 2 * Math.PI);
      ctx.fill();

      if (isRunning) t += 0.5;
      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [activeSim, frequency, sourceDist, isRunning]);

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col gap-6">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <Orbit className="w-5 h-5 text-indigo-500" />
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              Phòng Thí Nghiệm Mô Phỏng STEM &amp; Toán Học
            </h3>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Mô phỏng thuật toán vật lý &amp; hình học tham số hóa trực quan
          </p>
        </div>

        {/* Sim Type Selectors */}
        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl">
          <button
            type="button"
            onClick={() => setActiveSim('physics-projectile')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              activeSim === 'physics-projectile'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            Ném xiên
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveSim('physics-pendulum');
              pendulumAngleRef.current = (initialAngle * Math.PI) / 180;
              pendulumVelRef.current = 0;
            }}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              activeSim === 'physics-pendulum'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            Con lắc đơn
          </button>
          <button
            type="button"
            onClick={() => setActiveSim('math-fractal')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              activeSim === 'math-fractal'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            Cây Fractal
          </button>
          <button
            type="button"
            onClick={() => setActiveSim('math-waves')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              activeSim === 'math-waves'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            Giao thoa sóng
          </button>
        </div>
      </div>

      {/* Main Canvas & Parameter Controls */}
      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* Canvas Display */}
        <div className="flex-1 w-full flex flex-col items-center">
          <div className="relative w-full overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-950/5 dark:bg-slate-950 flex items-center justify-center">
            <canvas
              ref={canvasRef}
              width={560}
              height={340}
              className="w-full max-w-[560px] h-auto object-contain"
            />
            <div className="absolute top-3 right-3 flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setIsRunning(!isRunning)}
                className="p-1.5 rounded-lg bg-white/80 dark:bg-slate-800/80 backdrop-blur-xs border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-white cursor-pointer shadow-xs"
              >
                {isRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              </button>
              <button
                type="button"
                onClick={() => {
                  setProjTime(0);
                  pendulumAngleRef.current = (initialAngle * Math.PI) / 180;
                  pendulumVelRef.current = 0;
                  if (onNotify) onNotify('Đã thiết lập lại trạng thái ban đầu.', 'info');
                }}
                className="p-1.5 rounded-lg bg-white/80 dark:bg-slate-800/80 backdrop-blur-xs border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-white cursor-pointer shadow-xs"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Sidebar Controls */}
        <div className="w-full lg:w-72 bg-slate-50 dark:bg-slate-800/50 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col gap-4">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
            <Sliders className="w-4 h-4 text-blue-600" />
            <span>Tham số mô phỏng</span>
          </div>

          {/* SIM 1 CONTROLS: PROJECTILE */}
          {activeSim === 'physics-projectile' && (
            <div className="flex flex-col gap-3.5 text-xs">
              <div>
                <div className="flex justify-between mb-1 text-slate-600 dark:text-slate-400">
                  <span>Vận tốc đầu (v₀):</span>
                  <strong className="text-slate-900 dark:text-slate-100">{velocity} m/s</strong>
                </div>
                <input
                  type="range"
                  min="10"
                  max="50"
                  value={velocity}
                  onChange={(e) => setVelocity(Number(e.target.value))}
                  className="w-full accent-blue-600 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between mb-1 text-slate-600 dark:text-slate-400">
                  <span>Góc bắn (α):</span>
                  <strong className="text-slate-900 dark:text-slate-100">{angleDeg}°</strong>
                </div>
                <input
                  type="range"
                  min="15"
                  max="80"
                  value={angleDeg}
                  onChange={(e) => setAngleDeg(Number(e.target.value))}
                  className="w-full accent-blue-600 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between mb-1 text-slate-600 dark:text-slate-400">
                  <span>Gia tốc trọng trường (g):</span>
                  <strong className="text-slate-900 dark:text-slate-100">{gravity} m/s²</strong>
                </div>
                <input
                  type="range"
                  min="5"
                  max="20"
                  step="0.5"
                  value={gravity}
                  onChange={(e) => setGravity(Number(e.target.value))}
                  className="w-full accent-blue-600 cursor-pointer"
                />
              </div>

              {/* Readouts */}
              <div className="mt-2 p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col gap-1.5 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-slate-500">Tầm cao cực đại (Hₘₐₓ):</span>
                  <strong className="text-emerald-600">{maxHeight.toFixed(2)} m</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Tầm xa (L / R):</span>
                  <strong className="text-blue-600">{maxRange.toFixed(2)} m</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Thời gian bay (t):</span>
                  <strong className="text-amber-600">{maxTime.toFixed(2)} s</strong>
                </div>
              </div>
            </div>
          )}

          {/* SIM 2 CONTROLS: PENDULUM */}
          {activeSim === 'physics-pendulum' && (
            <div className="flex flex-col gap-3.5 text-xs">
              <div>
                <div className="flex justify-between mb-1 text-slate-600 dark:text-slate-400">
                  <span>Chiều dài dây (L):</span>
                  <strong className="text-slate-900 dark:text-slate-100">{length} px</strong>
                </div>
                <input
                  type="range"
                  min="80"
                  max="220"
                  value={length}
                  onChange={(e) => setLength(Number(e.target.value))}
                  className="w-full accent-blue-600 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between mb-1 text-slate-600 dark:text-slate-400">
                  <span>Biên độ góc ban đầu:</span>
                  <strong className="text-slate-900 dark:text-slate-100">{initialAngle}°</strong>
                </div>
                <input
                  type="range"
                  min="10"
                  max="70"
                  value={initialAngle}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setInitialAngle(val);
                    pendulumAngleRef.current = (val * Math.PI) / 180;
                  }}
                  className="w-full accent-blue-600 cursor-pointer"
                />
              </div>

              <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-[11px] text-slate-600 dark:text-slate-300">
                💡 <strong>Chu kỳ con lắc đơn:</strong> \(T = 2\pi\sqrt{"{"}L/g{"}"}\). Chu kỳ dao động tỉ lệ thuận với căn bậc hai của chiều dài dây treo.
              </div>
            </div>
          )}

          {/* SIM 3 CONTROLS: FRACTAL */}
          {activeSim === 'math-fractal' && (
            <div className="flex flex-col gap-3.5 text-xs">
              <div>
                <div className="flex justify-between mb-1 text-slate-600 dark:text-slate-400">
                  <span>Độ sâu đệ quy:</span>
                  <strong className="text-slate-900 dark:text-slate-100">Cấp {treeDepth}</strong>
                </div>
                <input
                  type="range"
                  min="3"
                  max="9"
                  value={treeDepth}
                  onChange={(e) => setTreeDepth(Number(e.target.value))}
                  className="w-full accent-blue-600 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between mb-1 text-slate-600 dark:text-slate-400">
                  <span>Góc rẽ nhánh:</span>
                  <strong className="text-slate-900 dark:text-slate-100">{branchAngle}°</strong>
                </div>
                <input
                  type="range"
                  min="10"
                  max="60"
                  value={branchAngle}
                  onChange={(e) => setBranchAngle(Number(e.target.value))}
                  className="w-full accent-blue-600 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between mb-1 text-slate-600 dark:text-slate-400">
                  <span>Tỉ lệ thu nhỏ nhánh:</span>
                  <strong className="text-slate-900 dark:text-slate-100">{lengthRatio.toFixed(2)}</strong>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="0.82"
                  step="0.02"
                  value={lengthRatio}
                  onChange={(e) => setLengthRatio(Number(e.target.value))}
                  className="w-full accent-blue-600 cursor-pointer"
                />
              </div>
            </div>
          )}

          {/* SIM 4 CONTROLS: WAVES */}
          {activeSim === 'math-waves' && (
            <div className="flex flex-col gap-3.5 text-xs">
              <div>
                <div className="flex justify-between mb-1 text-slate-600 dark:text-slate-400">
                  <span>Tần số sóng (f):</span>
                  <strong className="text-slate-900 dark:text-slate-100">{frequency} Hz</strong>
                </div>
                <input
                  type="range"
                  min="1"
                  max="5"
                  value={frequency}
                  onChange={(e) => setFrequency(Number(e.target.value))}
                  className="w-full accent-blue-600 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between mb-1 text-slate-600 dark:text-slate-400">
                  <span>Khoảng cách 2 nguồn (S₁S₂):</span>
                  <strong className="text-slate-900 dark:text-slate-100">{sourceDist} px</strong>
                </div>
                <input
                  type="range"
                  min="60"
                  max="200"
                  value={sourceDist}
                  onChange={(e) => setSourceDist(Number(e.target.value))}
                  className="w-full accent-blue-600 cursor-pointer"
                />
              </div>

              <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-[11px] text-slate-600 dark:text-slate-300">
                🌊 <strong>Hiện tượng giao thoa:</strong> Các vân cực đại (tăng cường) và cực tiểu (triệt tiêu) tạo thành họ các đường hyperbol đối xứng qua trung trực.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
