"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import { useAuth } from "@/context/AuthContext"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Loader2, Terminal } from "lucide-react"
import { useRouter } from "next/navigation"

export default function LoginPage() {
  const { login, verify2FA, resend2FA } = useAuth()
  const router = useRouter()

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [twoFactorCode, setTwoFactorCode] = useState("")
  const [showTwoFactor, setShowTwoFactor] = useState(false)
  const [trustDevice, setTrustDevice] = useState(false)
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [timer, setTimer] = useState(30)
  const [canResend, setCanResend] = useState(false)

  // Timer effect

  // Effect for timer
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (showTwoFactor && timer > 0) {
      interval = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
    } else if (timer === 0) {
      setCanResend(true);
    }
    return () => clearInterval(interval);
  }, [showTwoFactor, timer]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")

    try {
      if (showTwoFactor) {
        await verify2FA(twoFactorCode, trustDevice);
      } else {
        const result = await login(email, password);
        if (result.requires2FA) {
          setShowTwoFactor(true);
        }
      }
    } catch (err) {
      setError("Credenciales inválidas, código incorrecto o error de conexión");
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div
      className="flex min-h-screen items-center justify-center px-4 bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: "url('/login-bg.png')" }}
    >
      <Card className="w-full max-w-md bg-white/95 backdrop-blur-sm shadow-xl border-slate-200">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <Image
              src="/logo.webp"
              alt="Vesotel Logo"
              width={80}
              height={80}
              priority
              className="object-contain" // Use object-contain to ensure it fits nicely
              style={{ width: "auto", height: "auto" }} // Nextjs aspect ratio fix
            />
          </div>
          <CardTitle className="text-2xl font-bold">Ski Vesotel</CardTitle>
          {/* <CardDescription>Management Backoffice</CardDescription> Removed as requested */}
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {!showTwoFactor ? (
              <>
                <div className="space-y-2">
                  <label htmlFor="email" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    Email
                  </label>
                  <Input
                    id="email"
                    type="email"
                    placeholder=""
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="password" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    Password
                  </label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
              </>
            ) : (
              <div className="space-y-2">
                <div className="text-sm text-center mb-4 text-muted-foreground">
                  Hemos enviado un código de verificación a tu correo.
                </div>
                <label htmlFor="2fa" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  Código de Verificación
                </label>
                <div className="flex justify-center gap-2">
                  {Array.from({ length: 6 }).map((_, index) => (
                    <Input
                      key={index}
                      id={`otp-${index}`}
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={1}
                      value={twoFactorCode[index] || ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (!/^\d*$/.test(val)) return; // Only allow digits

                        const newCode = twoFactorCode.split("");
                        newCode[index] = val;
                        const newCodeStr = newCode.join("");
                        setTwoFactorCode(newCodeStr);

                        // Focus next input or submit
                        if (val && index < 5) {
                          const nextInput = document.getElementById(`otp-${index + 1}`);
                          nextInput?.focus();
                        } else if (val && index === 5 && newCodeStr.length === 6) {
                          setIsLoading(true);
                          // Small delay to allow state update? passed directly
                          verify2FA(newCodeStr, trustDevice)
                            .catch(() => {
                              setError("Código incorrecto o expirado");
                              setIsLoading(false);
                            });
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Backspace" && !twoFactorCode[index] && index > 0) {
                          const prevInput = document.getElementById(`otp-${index - 1}`);
                          prevInput?.focus();
                          // Delete prev char?
                          const newCode = twoFactorCode.split("");
                          newCode[index - 1] = "";
                          setTwoFactorCode(newCode.join(""));
                        }
                      }}
                      className="w-12 h-12 text-center text-xl"
                      required={index === 0} // Only first required implicitly? No, validation on submit
                    />
                  ))}
                </div>

                <div className="flex items-center space-x-2 mt-4 justify-center">
                  <Checkbox
                    id="trust-device"
                    checked={trustDevice}
                    onCheckedChange={(checked) => setTrustDevice(checked as boolean)}
                  />
                  <Label htmlFor="trust-device" className="text-sm cursor-pointer">
                    Confiar en este dispositivo por 30 días
                  </Label>
                </div>

                <div className="text-center mt-4">
                  {canResend ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={async () => {
                        setCanResend(false);
                        setTimer(30);
                        try {
                          await resend2FA();
                        } catch (e) {
                          setError("Error resending code");
                        }
                      }}
                    >
                      Resend Code
                    </Button>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Resend code in {timer}s
                    </p>
                  )}
                </div>
              </div>
            )}
            {error && (
              <div className="text-sm text-red-500 font-medium">
                {error}
              </div>
            )}
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isLoading ? "Signing in..." : "Sign In"}
            </Button>
            {/* Request Access Button */}
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="link" className="w-full text-xs text-muted-foreground mt-2">
                  Request Access
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Request Access</DialogTitle>
                  <DialogDescription>
                    Please contact the administrator to request access to the platform.
                    <br /><br />
                    Email: hugo@vesotel.com
                  </DialogDescription>
                </DialogHeader>
              </DialogContent>
            </Dialog>
          </form>
        </CardContent>
        <CardFooter className="flex justify-center text-xs text-muted-foreground">
          Vesotel Work Management © 2026
        </CardFooter>
      </Card>
    </div>
  )
}
