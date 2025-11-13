import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

const PRIZES = {
  COMBO: "Combo Completo (X-tudo + Batata PP + Coca 250ml) de R$28 por apenas R$19,90",
  XTUDO: "X-tudo de R$17 por apenas R$11,90",
  HOTDOG: "Hot-Dog Salsicha de R$17 por apenas R$11,90",
};

const PRIZE_CODES: Record<string, keyof typeof PRIZES> = {
  COMBO: "COMBO",
  XTUDO: "XTUDO",
  HOTDOG: "HOTDOG",
};

export default function Roleta() {
  const [name, setName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [isRegistered, setIsRegistered] = useState(false);
  const [showRegisterModal, setShowRegisterModal] = useState(true);
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [showPrizeModal, setShowPrizeModal] = useState(false);
  const [currentPrize, setCurrentPrize] = useState<string>("");
  const [couponNumber, setCouponNumber] = useState<string>("");
  const [timeLeft, setTimeLeft] = useState(3599);
  const [spinsRemaining, setSpinsRemaining] = useState(3);
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [limitMessage, setLimitMessage] = useState("");
  const [canClaim, setCanClaim] = useState(true);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const savedWhatsapp = localStorage.getItem("roleta_whatsapp");
    const savedName = localStorage.getItem("roleta_name");
    if (savedWhatsapp && savedName) {
      setWhatsapp(savedWhatsapp);
      setName(savedName);
      setIsRegistered(true);
      setShowRegisterModal(false);
      checkSpinsRemaining(savedWhatsapp);
    }
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

  const checkSpinsRemaining = async (phone: string) => {
    try {
      const { count } = await supabase
        .from("spins")
        .select("*", { count: "exact", head: true })
        .eq("whatsapp", phone)
        .gte("created_at", new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString());
      
      setSpinsRemaining(3 - (count || 0));
    } catch (error) {
      console.error("[Roleta] Error checking spins:", error);
    }
  };

  const handleRegister = async () => {
    const trimmedName = name.trim();
    const normalizedPhone = normalizeWhatsApp(whatsapp);

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
      await checkSpinsRemaining(normalizedPhone);
      toast.success("Cadastro realizado com sucesso!");
    } catch (error: any) {
      console.error("[Roleta] Registration error:", error);
      toast.error("Erro ao cadastrar. Tente novamente.");
    }
  };

  const handleSpin = async () => {
    if (spinning || spinsRemaining <= 0) return;

    setSpinning(true);
    
    try {
      const { data, error } = await supabase.functions.invoke("spin-wheel", {
        body: { whatsapp },
      });

      if (error) {
        if (error.message?.includes("429") || error.message?.includes("limit_reached")) {
          const nextAvailable = new Date(Date.now() + 12 * 60 * 60 * 1000);
          setLimitMessage(`Você já usou seus 3 giros! Volte às ${nextAvailable.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`);
          setShowLimitModal(true);
          setSpinning(false);
          return;
        }
        throw error;
      }

      const { prize, targetAngle, claimedToday } = data;
      
      // Sound and vibration
      if (!audioRef.current) {
        audioRef.current = new Audio("/sounds/tick.mp3");
        audioRef.current.volume = 0.5;
      }
      
      const playTick = () => {
        if (audioRef.current) {
          audioRef.current.currentTime = 0;
          audioRef.current.play().catch(() => {});
        }
        if (navigator.vibrate) {
          navigator.vibrate(12);
        }
      };

      const tickInterval = setInterval(playTick, 100);
      
      const spins = 3 + Math.random() * 2;
      const finalRotation = 360 * spins + targetAngle;
      
      setRotation(finalRotation);

      setTimeout(() => {
        clearInterval(tickInterval);
        setSpinning(false);
        
        if (claimedToday >= 3) {
          setLimitMessage("Você já resgatou suas 3 promoções de hoje! Volte amanhã para mais chances!");
          setShowLimitModal(true);
          setCanClaim(false);
        } else {
          const prizeKey = PRIZE_CODES[prize];
          setCurrentPrize(PRIZES[prizeKey]);
          setShowPrizeModal(true);
          setTimeLeft(3599);
          setCouponNumber("");
          setCanClaim(true);
        }
        
        checkSpinsRemaining(whatsapp);
      }, 5000);
      
    } catch (error) {
      console.error("[Roleta] Spin error:", error);
      setSpinning(false);
      toast.error("Erro ao girar. Tente novamente.");
    }
  };

  const handleClaimCoupon = async () => {
    try {
      // Extrair o código do prêmio do texto completo
      const prizeCode = Object.keys(PRIZES).find(
        key => PRIZES[key as keyof typeof PRIZES] === currentPrize
      );

      const { data, error } = await supabase.functions.invoke("claim-coupon", {
        body: { whatsapp, prize: prizeCode },
      });

      if (error) throw error;

      const formattedCoupon = `TOP-${data.couponNumber.toString().padStart(3, "0")}`;
      setCouponNumber(formattedCoupon);

      setTimeout(() => {
        window.location.href = "https://encurtador.com.br/eJNQ";
      }, 1000);
      
    } catch (error) {
      console.error("[Roleta] Claim error:", error);
      toast.error("Erro ao gerar cupom. Tente novamente.");
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 overflow-hidden">
      {/* Logo */}
      <div className="w-full max-w-[140px] mb-6">
        <img src="/logo.svg" alt="Logo" className="w-full h-auto mx-auto" />
      </div>

      {/* Wheel Section - Larger on mobile */}
      <div className="relative w-full max-w-[400px] aspect-square flex items-center justify-center mb-6">
        {/* Pointer (fixed at top) */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 z-20 w-16 h-16 md:w-20 md:h-20">
          <img src="/svg/ponteiro.svg" alt="Ponteiro" className="w-full h-full drop-shadow-lg" />
        </div>

        {/* Rotating Wheel */}
        <motion.div
          className="w-full h-full relative"
          animate={{ rotate: rotation }}
          transition={{
            duration: spinning ? 5 : 0,
            ease: spinning ? [0.25, 0.1, 0.25, 1] : "linear",
          }}
        >
          <img src="/svg/roleta.svg" alt="Roleta" className="w-full h-full" />
        </motion.div>
      </div>

      {/* Instructions & Button */}
      <div className="flex flex-col items-center gap-4 w-full max-w-md">
        <div className="text-center space-y-2">
          <h1 className="text-3xl md:text-4xl font-bold text-primary animate-glow">
            GIRE E GANHE!
          </h1>
          <p className="text-muted-foreground text-sm md:text-base">
            Você tem {spinsRemaining} {spinsRemaining === 1 ? "giro disponível" : "giros disponíveis"}
          </p>
        </div>

        <Button
          size="lg"
          onClick={handleSpin}
          disabled={spinning || spinsRemaining <= 0 || !isRegistered}
          className="w-full max-w-xs h-16 text-xl font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg hover:shadow-xl transition-all disabled:opacity-50"
        >
          {spinning ? "GIRANDO..." : "GIRAR AGORA!"}
        </Button>
      </div>

      {/* Registration Modal */}
      <Dialog open={showRegisterModal} onOpenChange={setShowRegisterModal}>
        <DialogContent className="sm:max-w-md bg-card border-border">
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
                placeholder="(00) 00000-0000"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                className="bg-background border-border"
              />
            </div>
            <Button
              onClick={handleRegister}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              Começar a Girar
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
                    disabled={timeLeft === 0 || !!couponNumber}
                    className="w-full h-14 text-lg font-bold bg-green-600 hover:bg-green-700 text-white shadow-lg disabled:opacity-50"
                  >
                    {timeLeft === 0 ? "OFERTA EXPIRADA" : couponNumber ? "REDIRECIONANDO..." : "✅ RESGATAR PROMOÇÃO AGORA"}
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
