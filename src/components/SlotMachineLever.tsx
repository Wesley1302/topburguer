import { motion } from "framer-motion";

interface SlotMachineLeverProps {
  onPull: () => void;
  disabled: boolean;
}

export const SlotMachineLever = ({ onPull, disabled }: SlotMachineLeverProps) => {
  return (
    <div className="relative w-20 h-64 flex items-start justify-center">
      <motion.button
        onClick={onPull}
        disabled={disabled}
        className="relative group"
        whileTap={!disabled ? { y: 120 } : {}}
        transition={{
          type: "spring",
          stiffness: 300,
          damping: 20,
        }}
      >
        {/* Bola vermelha */}
        <div className="relative z-10 w-16 h-16 rounded-full bg-gradient-to-br from-red-500 to-red-700 shadow-lg border-4 border-red-900 group-hover:from-red-400 group-hover:to-red-600 transition-colors duration-200">
          <div className="absolute inset-2 rounded-full bg-gradient-to-br from-red-400/50 to-transparent" />
          <div className="absolute top-3 left-3 w-4 h-4 rounded-full bg-white/40 blur-sm" />
        </div>
        
        {/* Haste prateada */}
        <div className="absolute top-12 left-1/2 -translate-x-1/2 w-3 h-52 bg-gradient-to-r from-gray-400 via-gray-300 to-gray-400 rounded-full shadow-lg">
          <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-r from-white/60 to-transparent rounded-l-full" />
          <div className="absolute inset-y-0 right-0 w-1 bg-gradient-to-l from-gray-600/60 to-transparent rounded-r-full" />
        </div>
      </motion.button>
      
      {/* Base da alavanca */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-20 h-8 bg-gradient-to-br from-gray-600 to-gray-800 rounded-lg shadow-xl border-2 border-gray-700">
        <div className="absolute inset-1 rounded bg-gradient-to-br from-gray-500/30 to-transparent" />
      </div>
    </div>
  );
};
