"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Loader2, KeyRound } from "lucide-react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/context/AuthContext"
import { changePassword } from "@/lib/api/users"
import { useToast } from "@/hooks/use-toast"

const formSchema = z.object({
  current_password: z.string().min(1, "La contraseña actual es requerida"),
  new_password: z.string().min(6, "La nueva contraseña debe tener al menos 6 caracteres"),
  confirm_password: z.string().min(6, "La confirmación de la contraseña debe tener al menos 6 caracteres"),
}).refine((data) => data.new_password === data.confirm_password, {
  message: "Las contraseñas no coinciden",
  path: ["confirm_password"],
})

export default function ForceChangePasswordPage() {
  const { checkAuth, user, logout } = useAuth()
  const router = useRouter()
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      current_password: "",
      new_password: "",
      confirm_password: "",
    },
  })

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setIsLoading(true)
    try {
      await changePassword({
        current_password: values.current_password,
        new_password: values.new_password,
      })
      toast({
        title: "Contraseña actualizada",
        description: "Tu contraseña ha sido actualizada correctamente.",
      })
      // Refresh user context to clear must_change_password
      await checkAuth()
      
      // Redirect based on role
      if (user?.role === 'admin') {
        router.push('/admin/companies')
      } else if (user?.isManager) {
        router.push('/manager/daily-reports')
      } else {
        router.push('/dashboard')
      }
    } catch (err: any) {
      toast({
        title: "Error al cambiar la contraseña",
        description: err.response?.data?.detail || "Por favor, verifica tu contraseña actual.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="w-full bg-white/95 shadow-xl border-slate-200">
      <CardHeader className="text-center">
        <div className="flex justify-center mb-4 text-primary">
          <div className="p-3 bg-red-100 rounded-full">
            <KeyRound className="h-8 w-8 text-red-600" />
          </div>
        </div>
        <CardTitle className="text-2xl font-bold">Cambio de Contraseña Obligatorio</CardTitle>
        <CardDescription>
          Por razones de seguridad, debes actualizar la contraseña temporal antes de continuar usando la plataforma.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="current_password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Contraseña Temporal / Actual</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="******" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="new_password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nueva Contraseña</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="******" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="confirm_password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Confirmar Nueva Contraseña</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="******" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Actualizar y Continuar
            </Button>
          </form>
        </Form>
      </CardContent>
      <CardFooter className="flex justify-center">
        <Button variant="ghost" size="sm" onClick={() => logout()} className="text-xs text-muted-foreground">
          Cerrar Sesión
        </Button>
      </CardFooter>
    </Card>
  )
}
