interface WheelSlice {
  id: number;
  name: string;
  displayName: string;
  color: string;
  textColor: string;
  canWin: boolean;
}

interface WheelCanvasProps {
  slices: WheelSlice[];
}

export const WheelCanvas = ({ slices }: WheelCanvasProps) => {
  const centerX = 200;
  const centerY = 200;
  const radius = 170;
  const innerWhiteRadius = 180;
  const outerRedRadius = 195;
  const sliceAngle = 60; // 360 / 6 slices

  const polarToCartesian = (angle: number, r: number) => {
    const angleInRadians = ((angle - 90) * Math.PI) / 180;
    return {
      x: centerX + r * Math.cos(angleInRadians),
      y: centerY + r * Math.sin(angleInRadians),
    };
  };

  const createSlicePath = (startAngle: number, endAngle: number) => {
    const start = polarToCartesian(startAngle, radius);
    const end = polarToCartesian(endAngle, radius);
    const largeArcFlag = endAngle - startAngle <= 180 ? 0 : 1;

    return [
      `M ${centerX} ${centerY}`,
      `L ${start.x} ${start.y}`,
      `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${end.x} ${end.y}`,
      'Z',
    ].join(' ');
  };

  return (
    <svg viewBox="0 0 400 400" className="w-full h-full">
      {/* Outer red border with decorative dots */}
      <circle
        cx={centerX}
        cy={centerY}
        r={outerRedRadius}
        fill="#ef4444"
        stroke="none"
      />
      
      {/* Yellow decorative circles at cardinal points */}
      {[0, 90, 180, 270].map((angle) => {
        const pos = polarToCartesian(angle, outerRedRadius - 5);
        return (
          <circle
            key={angle}
            cx={pos.x}
            cy={pos.y}
            r="12"
            fill="#fde047"
            stroke="none"
          />
        );
      })}

      {/* Inner white border */}
      <circle
        cx={centerX}
        cy={centerY}
        r={innerWhiteRadius}
        fill="white"
        stroke="none"
      />

      {/* Wheel slices */}
      {slices.map((slice, index) => {
        const startAngle = index * sliceAngle;
        const endAngle = startAngle + sliceAngle;
        const middleAngle = startAngle + sliceAngle / 2;
        const textRadius = radius * 0.65;
        const textPos = polarToCartesian(middleAngle, textRadius);

        return (
          <g key={slice.id}>
            {/* Slice path */}
            <path
              d={createSlicePath(startAngle, endAngle)}
              fill={slice.color}
              stroke="white"
              strokeWidth="2"
            />
            
            {/* Text */}
            <text
              x={textPos.x}
              y={textPos.y}
              fill={slice.textColor}
              fontSize="20"
              fontWeight="bold"
              textAnchor="middle"
              dominantBaseline="middle"
              transform={`rotate(${middleAngle}, ${textPos.x}, ${textPos.y})`}
              style={{ fontFamily: 'Arial, sans-serif' }}
            >
              {slice.displayName.split('\n').map((line, i) => (
                <tspan
                  key={i}
                  x={textPos.x}
                  dy={i === 0 ? 0 : '1.2em'}
                >
                  {line}
                </tspan>
              ))}
            </text>
          </g>
        );
      })}

      {/* Center golden circle */}
      <circle
        cx={centerX}
        cy={centerY}
        r="28"
        fill="#facc15"
        stroke="#f59e0b"
        strokeWidth="4"
      />
    </svg>
  );
};
