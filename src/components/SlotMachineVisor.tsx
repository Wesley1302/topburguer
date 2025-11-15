import { motion } from "framer-motion";
import { useEffect, useState } from "react";

interface SlotItem {
  id: number;
  name: string;
  displayName: string;
  textColor: string;
  canWin: boolean;
}

interface SlotMachineVisorProps {
  slices: SlotItem[];
  isSpinning: boolean;
  finalPrize: string;
  onSpinComplete: () => void;
  shouldReset: boolean;
}

export const SlotMachineVisor = ({ slices, isSpinning, finalPrize, onSpinComplete, shouldReset }: SlotMachineVisorProps) => {
  const [items, setItems] = useState<SlotItem[]>([]);
  const [offset, setOffset] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const ITEM_HEIGHT = 120;
  const VISIBLE_ITEMS = 3;
  const TOTAL_HEIGHT = ITEM_HEIGHT * VISIBLE_ITEMS;

  // Inicializar visor na primeira montagem para evitar engasgo
  useEffect(() => {
    setItems(slices.slice(0, 5).map((s, i) => ({ ...s, id: i })));
  }, []);

  // Criar sequência de itens para o slot
  useEffect(() => {
    if (isSpinning) {
      setIsComplete(false);
      
      // Criar uma sequência longa de itens aleatórios
      const sequence: SlotItem[] = [];
      
      // Adicionar itens aleatórios (variar quantidade para mais randomização)
      const randomCount = Math.floor(Math.random() * 10) + 35; // 35-45 itens
      for (let i = 0; i < randomCount; i++) {
        const randomSlice = slices[Math.floor(Math.random() * slices.length)];
        sequence.push({ ...randomSlice, id: i });
      }
      
      // Adicionar "NÃO GANHOU" nos últimos itens (mas não no final)
      const loseSlice = slices.find(s => !s.canWin);
      if (loseSlice) {
        sequence.push({ ...loseSlice, id: sequence.length });
        sequence.push({ ...loseSlice, id: sequence.length });
      }
      
      // Adicionar o prêmio final
      const finalSlice = slices.find(s => s.name === finalPrize);
      if (finalSlice) {
        sequence.push({ ...finalSlice, id: sequence.length });
      }
      
      // Primeiro atualizar items
      setItems(sequence);
      
      // Definir offset final
      const finalOffset = -(sequence.length - 1) * ITEM_HEIGHT + ITEM_HEIGHT;
      
      // Esperar o React renderizar os items antes de iniciar animação
      setTimeout(() => {
        requestAnimationFrame(() => {
          setOffset(finalOffset);
        });
      }, 0);
    }
  }, [isSpinning, finalPrize, slices]);

  // Reset do visor quando shouldReset mudar
  useEffect(() => {
    if (shouldReset) {
      setOffset(0);
      setItems(slices.slice(0, 5).map((s, i) => ({ ...s, id: i })));
      setIsComplete(false);
    }
  }, [shouldReset, slices]);

  useEffect(() => {
    if (isSpinning && offset < 0 && !isComplete) {
      const duration = 6000; // 6 segundos
      const timer = setTimeout(() => {
        setIsComplete(true);
        onSpinComplete();
      }, duration);
      
      return () => clearTimeout(timer);
    }
  }, [isSpinning, offset, onSpinComplete, isComplete]);

  return (
    <div className="relative w-full max-w-[280px] mx-auto">
      {/* Visor do caça-níquel */}
      <div 
        className="relative bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-2xl p-4 shadow-2xl overflow-hidden"
        style={{ height: `${TOTAL_HEIGHT + 32}px` }}
      >
        {/* Bordas metálicas */}
        <div className="absolute inset-0 rounded-2xl border-4 border-gray-600 shadow-inner pointer-events-none" />
        <div className="absolute inset-2 rounded-xl border-2 border-gray-700 pointer-events-none" />
        
        {/* Área visível do slot */}
        <div 
          className="relative bg-black rounded-xl overflow-hidden"
          style={{ height: `${TOTAL_HEIGHT}px` }}
        >
          {/* Highlight no centro */}
          <div 
            className="absolute left-0 right-0 z-10 border-t-4 border-b-4 border-yellow-400 pointer-events-none"
            style={{ 
              top: `${ITEM_HEIGHT}px`, 
              height: `${ITEM_HEIGHT}px`,
              boxShadow: 'inset 0 0 20px rgba(250, 204, 21, 0.3)'
            }}
          />
          
          {/* Itens rolando */}
          <motion.div
            className="relative will-change-transform"
            initial={{ y: 0 }}
            animate={{ y: offset }}
            transition={{
              duration: isSpinning ? 6 : 0,
              ease: isSpinning ? [0.33, 0, 0.2, 1] : "linear",
              type: "tween"
            }}
            style={{ 
              transform: 'translateZ(0)',
              backfaceVisibility: 'hidden' as const
            }}
          >
            {items.map((item, index) => {
              // Determinar se é o penúltimo item (NÃO GANHOU que quase para)
              const isPenultimate = index === items.length - 2;
              const isLast = index === items.length - 1;
              
              return (
                <motion.div
                  key={item.id}
                  className="flex items-center justify-center border-b border-gray-800 will-change-transform"
                  style={{ 
                    height: `${ITEM_HEIGHT}px`,
                    transform: 'translateZ(0)',
                    backfaceVisibility: 'hidden' as const
                  }}
                  animate={
                    isSpinning && isPenultimate
                      ? {
                          y: [0, -5, -10, -15, -20, -25, -30],
                        }
                      : {}
                  }
                  transition={
                    isPenultimate
                      ? {
                          duration: 2,
                          delay: 3,
                          ease: [0.33, 0, 0.2, 1],
                          type: "tween"
                        }
                      : {}
                  }
                >
                  <span
                    className="text-3xl font-black text-center px-4 whitespace-pre-line"
                    style={{ 
                      color: item.textColor,
                      textShadow: `0 0 10px ${item.textColor}80, 0 0 20px ${item.textColor}40`,
                      letterSpacing: '-1px'
                    }}
                  >
                    {item.displayName}
                  </span>
                </motion.div>
              );
            })}
          </motion.div>
        </div>
        
        {/* Efeito de vidro/reflexo */}
        <div className="absolute inset-4 rounded-xl pointer-events-none bg-gradient-to-br from-white/5 to-transparent" />
      </div>
    </div>
  );
};
