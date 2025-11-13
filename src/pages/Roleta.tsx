import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { SlotMachineVisor } from "@/components/SlotMachineVisor";

const PRIZES = {
  COMBO: "Combo Completo (X-tudo + Batata PP + Coca 250ml) de R$28 por apenas R$19,90",
  XTUDO: "X-tudo de R$17 por apenas R$11,90",
  HOTDOG: "Hot-Dog Salsicha de R$17 por apenas R$11,90",
};

const COUPONS = {
  COMBO: "TOP-COMBOS",
  XTUDO: "TOP-XTUDO",
  HOTDOG: "TOP-HOTDOG",
};

const WHATSAPP_LINKS = {
  COMBO: "https://encurtador.com.br/DWXb",
  XTUDO: "https://encurtador.com.br/fKWp",
  HOTDOG: "https://encurtador.com.br/CjgU",
};

// Itens do caça-níquel
const SLOT_ITEMS = [
  { id: 1, name: 'LOSE', displayName: 'NÃO\nGANHOU', textColor: '#ff0040', canWin: false },
  { id: 2, name: 'HOTDOG', displayName: 'Hot-Dog', textColor: '#39ff14', canWin: true },
  { id: 3, name: 'LOSE', displayName: 'NÃO\nGANHOU', textColor: '#ff0040', canWin: false },
  { id: 4, name: 'XTUDO', displayName: 'X-tudo', textColor: '#39ff14', canWin: true },
  { id: 5, name: 'LOSE', displayName: 'NÃO\nGANHOU', textColor: '#ff0040', canWin: false },
  { id: 6, name: 'COMBO', displayName: 'Combo Simples', textColor: '#39ff14', canWin: true }
];


export default function Roleta() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [isRegistered, setIsRegistered] = useState(false);
  const [showRegisterModal, setShowRegisterModal] = useState(true);
  const [spinning, setSpinning] = useState(false);
  const [showPrizeModal, setShowPrizeModal] = useState(false);
  const [finalPrize, setFinalPrize] = useState("");
  const [shouldResetVisor, setShouldResetVisor] = useState(false);
  const [currentPrize, setCurrentPrize] = useState<string>("");
  const [prizeCode, setPrizeCode] = useState<string>("");
  const [couponNumber, setCouponNumber] = useState<string>("");
  const [timeLeft, setTimeLeft] = useState(3599);
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [limitMessage, setLimitMessage] = useState("");
  const [canClaim, setCanClaim] = useState(true);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Limpar localStorage ao carregar a página para sempre resetar o cadastro
  useEffect(() => {
    localStorage.removeItem("roleta_whatsapp");
    localStorage.removeItem("roleta_name");
  }, []);


  useEffect(() => {
    if (showPrizeModal && timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            if (timerRef.current) clearInterval(timerRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      
      return () => {
        if (timerRef.current) clearInterval(timerRef.current);
      };
    }
  }, [showPrizeModal, timeLeft]);

  useEffect(() => {
    const handleResize = () => {
      if (window.visualViewport) {
        const viewportHeight = window.visualViewport.height;
        const windowHeight = window.innerHeight;
        // Se o viewport diminuiu significativamente, o teclado está visível
        setKeyboardVisible(windowHeight - viewportHeight > 150);
      }
    };

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleResize);
      window.visualViewport.addEventListener('scroll', handleResize);
    }

    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleResize);
        window.visualViewport.removeEventListener('scroll', handleResize);
      }
    };
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const normalizeWhatsApp = (phone: string): string => {
    const digits = phone.replace(/\D/g, "");
    if (digits.length >= 11 && digits.length <= 13) {
      return digits.startsWith("55") ? digits : `55${digits}`;
    }
    return "";
  };


  const handleRegister = async () => {
    const trimmedName = name.trim();
    const normalizedPhone = normalizeWhatsApp(whatsapp);

    // Check for admin access
    if (trimmedName.toLowerCase() === "admin" && whatsapp.trim() === "00000000000") {
      navigate("/admin");
      return;
    }

    if (trimmedName.length < 2 || trimmedName.length > 60) {
      toast.error("Nome deve ter entre 2 e 60 caracteres");
      return;
    }

    if (!normalizedPhone) {
      toast.error("WhatsApp inválido");
      return;
    }

    try {
      const { error } = await supabase.functions.invoke("register-lead", {
        body: { name: trimmedName, whatsapp: normalizedPhone },
      });

      if (error) throw error;

      localStorage.setItem("roleta_whatsapp", normalizedPhone);
      localStorage.setItem("roleta_name", trimmedName);
      setWhatsapp(normalizedPhone);
      setName(trimmedName);
      setIsRegistered(true);
      setShowRegisterModal(false);
      toast.success("Cadastro realizado com sucesso!");
    } catch (error: any) {
      console.error("[Roleta] Registration error:", error);
      toast.error("Erro ao cadastrar. Tente novamente.");
    }
  };

  const handleSpin = async () => {
    if (spinning) return;

    // Reset do visor antes de começar
    setShouldResetVisor(false);
    setSpinning(true);
    
    try {
      const { data, error } = await supabase.functions.invoke("spin-wheel", {
        body: { whatsapp },
      });

      if (error) {
        console.error("[Roleta] Spin error:", error);
        toast.error("Erro ao girar a roleta");
        setSpinning(false);
        return;
      }

      const { prize, targetAngle, claimedToday } = data;
      console.log('Spin result:', { prize, targetAngle, claimedToday });
      
      // Salvar informações do prêmio ANTES de iniciar animação
      setPrizeCode(prize);
      setCurrentPrize(PRIZES[prize as keyof typeof PRIZES]);
      setCouponNumber(COUPONS[prize as keyof typeof COUPONS]);
      
      // Definir o prêmio final para o slot
      setFinalPrize(prize);
      
      // Create Web Audio API tick sound
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      
      const playTick = () => {
        try {
          if (audioContextRef.current) {
            const oscillator = audioContextRef.current.createOscillator();
            const gainNode = audioContextRef.current.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContextRef.current.destination);
            
            oscillator.frequency.value = 800; // Hz
            oscillator.type = 'square';
            
            gainNode.gain.setValueAtTime(0.3, audioContextRef.current.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContextRef.current.currentTime + 0.05);
            
            oscillator.start(audioContextRef.current.currentTime);
            oscillator.stop(audioContextRef.current.currentTime + 0.05);
          }
          
          if (navigator.vibrate) {
            navigator.vibrate(12);
          }
        } catch (e) {
          console.log('Audio playback failed:', e);
        }
      };

      const tickInterval = setInterval(playTick, 100);

      // Parar som após 5s (fim da animação)
      setTimeout(() => {
        clearInterval(tickInterval);
      }, 5000);

      // Aguardar a animação terminar antes de mostrar o modal
      setTimeout(() => {
        setSpinning(false);
        console.log('Animation complete, showing modal for prize:', prize);
      }, 8000);
      
    } catch (error) {
      console.error("[Roleta] Spin error:", error);
      setSpinning(false);
      toast.error("Erro ao girar. Tente novamente.");
    }
  };

  const handleSlotComplete = () => {
    // Mostrar modal após o slot parar (chamado pelo SlotMachineVisor)
    console.log('Slot animation complete, will show modal in 3s');
    setTimeout(() => {
      console.log('Opening modal with prizeCode:', prizeCode);
      if (prizeCode) {
        // Tocar som de celebração
        playCelebrationSound();
        
        setShowPrizeModal(true);
        setTimeLeft(3599);
        setCanClaim(true);
        
        // Resetar o visor assim que o modal abrir
        setTimeout(() => {
          setShouldResetVisor(true);
          setTimeout(() => {
            setShouldResetVisor(false);
          }, 100);
        }, 200);
      }
    }, 500);
  };

  const playCelebrationSound = () => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      
      const ctx = audioContextRef.current;
      const now = ctx.currentTime;
      
      // Sequência de notas ascendente (celebração)
      const notes = [523.25, 659.25, 783.99, 1046.50]; // Dó, Mi, Sol, Dó (oitava acima)
      
      notes.forEach((freq, i) => {
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);
        
        oscillator.frequency.value = freq;
        oscillator.type = 'sine';
        
        const startTime = now + (i * 0.15);
        const endTime = startTime + 0.3;
        
        gainNode.gain.setValueAtTime(0.3, startTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, endTime);
        
        oscillator.start(startTime);
        oscillator.stop(endTime);
      });
      
      // Vibração de celebração
      if (navigator.vibrate) {
        navigator.vibrate([100, 50, 100, 50, 100]);
      }
    } catch (e) {
      console.log('Audio playback failed:', e);
    }
  };

  const handleCloseModal = () => {
    console.log('Closing modal');
    setShowPrizeModal(false);
  };

  const handleClaimCoupon = async () => {
    try {
      const whatsappLink = WHATSAPP_LINKS[prizeCode as keyof typeof WHATSAPP_LINKS];
      
      setTimeout(() => {
        window.location.href = whatsappLink;
      }, 500);
      
    } catch (error) {
      console.error("[Roleta] Claim error:", error);
      toast.error("Erro ao redirecionar. Tente novamente.");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-red-950 to-gray-900 flex flex-col items-center justify-start pt-4 p-4 pb-48 overflow-hidden">
      {/* Logo */}
      <div className="w-full max-w-[120px] mb-6">
        <img src="/logo.svg" alt="Logo" className="w-full h-auto mx-auto" />
      </div>

      {/* Slot Machine Section */}
      <div className="relative w-full flex flex-col items-center justify-center gap-6 mb-8">
        {/* Visor do Caça-Níquel */}
        <div className="flex-shrink-0">
          <SlotMachineVisor 
            slices={SLOT_ITEMS}
            isSpinning={spinning}
            finalPrize={finalPrize}
            onSpinComplete={handleSlotComplete}
            shouldReset={shouldResetVisor}
          />
        </div>

        {/* Botão Testar a Sorte */}
        <Button
          onClick={handleSpin}
          disabled={!isRegistered || spinning}
          size="lg"
          className="w-full max-w-xs h-16 text-xl font-bold bg-gradient-to-r from-yellow-400 to-yellow-600 hover:from-yellow-500 hover:to-yellow-700 text-gray-900 shadow-xl hover:shadow-2xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {spinning ? "GIRANDO..." : "🎰 TESTAR A SORTE"}
        </Button>
      </div>

      {/* Registration Modal */}
      <Dialog open={showRegisterModal} onOpenChange={(open) => {
        // Prevent closing the modal
        if (!isRegistered) return;
        setShowRegisterModal(open);
      }}>
        <DialogContent className={`sm:max-w-md bg-card border-border transition-all duration-300 ${keyboardVisible ? 'fixed top-4 translate-y-0' : 'sm:top-[5%]'}`} onInteractOutside={(e) => {
          // Prevent closing when clicking outside if not registered
          if (!isRegistered) e.preventDefault();
        }} onEscapeKeyDown={(e) => {
          // Prevent closing with ESC key if not registered
          if (!isRegistered) e.preventDefault();
        }}>
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-center text-primary">
              Cadastre-se para Participar
            </DialogTitle>
            <DialogDescription className="text-center text-muted-foreground">
              Preencha seus dados para começar a girar
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome</Label>
              <Input
                id="name"
                placeholder="Seu nome completo"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={60}
                className="bg-background border-border"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="whatsapp">WhatsApp</Label>
              <Input
                id="whatsapp"
                type="tel"
                inputMode="numeric"
                placeholder="(00) 00000-0000"
                value={whatsapp}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, "");
                  setWhatsapp(value);
                }}
                className="bg-background border-border"
              />
            </div>
            <Button
              onClick={handleRegister}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              Testar minha sorte
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Prize Modal - X-TUDO */}
      <AnimatePresence>
        {showPrizeModal && canClaim && prizeCode === 'XTUDO' && (
          <Dialog open={showPrizeModal} onOpenChange={handleCloseModal}>
            <DialogContent className="w-[95vw] max-w-md mx-auto bg-card border-border max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-2xl font-bold text-center text-primary">
                  🎉 PARABÉNS! 🎉
                </DialogTitle>
                <DialogDescription className="text-center space-y-4 pt-4">
                  <p className="text-lg font-semibold text-foreground">
                    Você ganhou um X-TUDO!
                  </p>
                  <p className="text-base text-foreground">
                    {currentPrize}
                  </p>
                  <div className="bg-secondary/50 p-4 rounded-lg border border-primary/20">
                    <p className="text-sm font-medium text-muted-foreground mb-2">
                      🎫 SEU CUPOM:
                    </p>
                    <p className="text-3xl font-bold text-primary tracking-wider">
                      {couponNumber}
                    </p>
                  </div>
                  <div className="bg-destructive/10 p-3 rounded-lg border border-destructive/20">
                    <p className="text-sm font-medium text-destructive">
                      ⏰ EXPIRA EM:
                    </p>
                    <p className="text-2xl font-bold text-destructive mt-1">
                      {formatTime(timeLeft)}
                    </p>
                  </div>
                </DialogDescription>
              </DialogHeader>
              <Button
                onClick={handleClaimCoupon}
                className="w-full bg-green-600 hover:bg-green-700 text-white text-lg py-6"
              >
                💬 RESGATAR NO WHATSAPP
              </Button>
            </DialogContent>
          </Dialog>
        )}
      </AnimatePresence>

      {/* Prize Modal - HOTDOG */}
      <AnimatePresence>
        {showPrizeModal && canClaim && prizeCode === 'HOTDOG' && (
          <Dialog open={showPrizeModal} onOpenChange={handleCloseModal}>
            <DialogContent className="w-[95vw] max-w-md mx-auto bg-card border-border max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-2xl font-bold text-center text-primary">
                  🎉 PARABÉNS! 🎉
                </DialogTitle>
                <DialogDescription className="text-center space-y-4 pt-4">
                  <p className="text-lg font-semibold text-foreground">
                    Você ganhou um HOT-DOG!
                  </p>
                  <p className="text-base text-foreground">
                    {currentPrize}
                  </p>
                  <div className="bg-secondary/50 p-4 rounded-lg border border-primary/20">
                    <p className="text-sm font-medium text-muted-foreground mb-2">
                      🎫 SEU CUPOM:
                    </p>
                    <p className="text-3xl font-bold text-primary tracking-wider">
                      {couponNumber}
                    </p>
                  </div>
                  <div className="bg-destructive/10 p-3 rounded-lg border border-destructive/20">
                    <p className="text-sm font-medium text-destructive">
                      ⏰ EXPIRA EM:
                    </p>
                    <p className="text-2xl font-bold text-destructive mt-1">
                      {formatTime(timeLeft)}
                    </p>
                  </div>
                </DialogDescription>
              </DialogHeader>
              <Button
                onClick={handleClaimCoupon}
                className="w-full bg-green-600 hover:bg-green-700 text-white text-lg py-6"
              >
                💬 RESGATAR NO WHATSAPP
              </Button>
            </DialogContent>
          </Dialog>
        )}
      </AnimatePresence>

      {/* Prize Modal - COMBO */}
      <AnimatePresence>
        {showPrizeModal && canClaim && prizeCode === 'COMBO' && (
          <Dialog open={showPrizeModal} onOpenChange={handleCloseModal}>
            <DialogContent className="w-[95vw] max-w-md mx-auto bg-card border-border max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-2xl font-bold text-center text-primary">
                  🎉 PARABÉNS! 🎉
                </DialogTitle>
                <DialogDescription className="text-center space-y-4 pt-4">
                  <p className="text-lg font-semibold text-foreground">
                    Você ganhou um COMBO SIMPLES!
                  </p>
                  <p className="text-base text-foreground">
                    {currentPrize}
                  </p>
                  <div className="bg-secondary/50 p-4 rounded-lg border border-primary/20">
                    <p className="text-sm font-medium text-muted-foreground mb-2">
                      🎫 SEU CUPOM:
                    </p>
                    <p className="text-3xl font-bold text-primary tracking-wider">
                      {couponNumber}
                    </p>
                  </div>
                  <div className="bg-destructive/10 p-3 rounded-lg border border-destructive/20">
                    <p className="text-sm font-medium text-destructive">
                      ⏰ EXPIRA EM:
                    </p>
                    <p className="text-2xl font-bold text-destructive mt-1">
                      {formatTime(timeLeft)}
                    </p>
                  </div>
                </DialogDescription>
              </DialogHeader>
              <Button
                onClick={handleClaimCoupon}
                className="w-full bg-green-600 hover:bg-green-700 text-white text-lg py-6"
              >
                💬 RESGATAR NO WHATSAPP
              </Button>
            </DialogContent>
          </Dialog>
        )}
      </AnimatePresence>

      {/* Limit Modal */}
      <AnimatePresence>
        {showLimitModal && (
          <Dialog open={showLimitModal} onOpenChange={setShowLimitModal}>
            <DialogContent className="sm:max-w-md bg-card border-border">
              <DialogHeader>
                <DialogTitle className="text-xl font-bold text-center text-primary">
                  Limite Atingido
                </DialogTitle>
                <DialogDescription className="text-center pt-4">
                  <p className="text-base text-foreground">{limitMessage}</p>
                </DialogDescription>
              </DialogHeader>
              <Button
                onClick={() => setShowLimitModal(false)}
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                Entendi
              </Button>
            </DialogContent>
          </Dialog>
        )}
      </AnimatePresence>

      {/* Registration Modal */}
      <Dialog open={showRegisterModal} onOpenChange={(open) => {
        // Prevent closing the modal
        if (!isRegistered) return;
        setShowRegisterModal(open);
      }}>
        <DialogContent className={`sm:max-w-md bg-card border-border transition-all duration-300 ${keyboardVisible ? 'fixed top-4 translate-y-0' : 'sm:top-[5%]'}`} onInteractOutside={(e) => {
          // Prevent closing when clicking outside if not registered
          if (!isRegistered) e.preventDefault();
        }} onEscapeKeyDown={(e) => {
          // Prevent closing with ESC key if not registered
          if (!isRegistered) e.preventDefault();
        }}>
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-center text-primary">
              Cadastre-se para Participar
            </DialogTitle>
            <DialogDescription className="text-center text-muted-foreground">
              Preencha seus dados para começar a girar
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome</Label>
              <Input
                id="name"
                placeholder="Seu nome completo"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={60}
                className="bg-background border-border"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="whatsapp">WhatsApp</Label>
              <Input
                id="whatsapp"
                type="tel"
                inputMode="numeric"
                placeholder="(00) 00000-0000"
                value={whatsapp}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, "");
                  setWhatsapp(value);
                }}
                className="bg-background border-border"
              />
            </div>
            <Button
              onClick={handleRegister}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              Testar minha sorte
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Prize Modal */}
      <AnimatePresence>
        {showPrizeModal && canClaim && (
          <Dialog open={showPrizeModal} onOpenChange={setShowPrizeModal}>
            <DialogContent className="sm:max-w-lg bg-card border-border">
              <DialogHeader>
                <DialogTitle className="text-2xl font-bold text-center text-primary">
                  🎉 PARABÉNS, VOCÊ GANHOU! 🎉
                </DialogTitle>
                <DialogDescription className="text-center space-y-4 pt-4">
                  <p className="text-lg font-semibold text-foreground">
                    Sua sorte chegou!
                  </p>
                  <p className="text-base text-foreground">
                    Você acabou de ganhar: <span className="font-bold text-primary">{currentPrize}</span>
                  </p>
                  <div className="bg-secondary/50 p-4 rounded-lg border border-primary/20">
                    <p className="text-sm font-medium text-muted-foreground mb-2">
                      🎫 SEU CUPOM EXCLUSIVO:
                    </p>
                    <p className="text-3xl font-bold text-primary tracking-wider">
                      {couponNumber || "TOP-— — —"}
                    </p>
                  </div>
                  <div className="bg-destructive/10 p-3 rounded-lg border border-destructive/20">
                    <p className="text-sm font-medium text-destructive">
                      ⏰ ATENÇÃO: SUA OFERTA EXPIRA EM:
                    </p>
                    <p className="text-2xl font-bold text-destructive mt-1">
                      {formatTime(timeLeft)}
                    </p>
                  </div>
                  <div className="text-sm text-muted-foreground space-y-2 text-left">
                    <p className="font-semibold">⚠️ Importante: Cada pessoa pode resgatar até 3 promoções por dia.</p>
                    <p className="font-semibold text-primary">🚀 COMO RESGATAR AGORA:</p>
                    <ol className="list-decimal list-inside space-y-1 pl-2">
                      <li>Clique no botão verde abaixo</li>
                      <li>Fale com nossa atendente no WhatsApp</li>
                      <li>Informe seu cupom {couponNumber || "TOP-XXX"} e qual prêmio você ganhou</li>
                      <li>Pronto! É só retirar e aproveitar! 😋</li>
                    </ol>
                  </div>
                  <Button
                    size="lg"
                    onClick={handleClaimCoupon}
                    disabled={timeLeft === 0}
                    className="w-full h-14 text-lg font-bold bg-green-600 hover:bg-green-700 text-white shadow-lg disabled:opacity-50"
                  >
                    {timeLeft === 0 ? "OFERTA EXPIRADA" : "✅ RESGATAR PROMOÇÃO AGORA"}
                  </Button>
                </DialogDescription>
              </DialogHeader>
            </DialogContent>
          </Dialog>
        )}
      </AnimatePresence>

      {/* Limit Modal */}
      <Dialog open={showLimitModal} onOpenChange={setShowLimitModal}>
        <DialogContent className="sm:max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-center text-primary">
              Limite Atingido
            </DialogTitle>
            <DialogDescription className="text-center text-muted-foreground py-4">
              {limitMessage}
            </DialogDescription>
          </DialogHeader>
          <Button onClick={() => setShowLimitModal(false)} className="w-full">
            Entendi
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
