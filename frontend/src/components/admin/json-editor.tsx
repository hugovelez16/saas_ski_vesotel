"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { AlertCircle, CheckCircle2 } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

interface JsonEditorProps {
    initialValue: any
    onSave: (value: any) => void
    label?: string
    description?: string
    rows?: number
}

export function JsonEditor({ initialValue, onSave, label, description, rows = 12 }: JsonEditorProps) {
    const [value, setValue] = React.useState(JSON.stringify(initialValue, null, 2))
    const [error, setError] = React.useState<string | null>(null)
    const [isValid, setIsValid] = React.useState(true)

    const initialValueString = JSON.stringify(initialValue, null, 2)
    React.useEffect(() => {
        setValue(initialValueString)
    }, [initialValueString])

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newVal = e.target.value
        setValue(newVal)
        try {
            JSON.parse(newVal)
            setError(null)
            setIsValid(true)
        } catch (err: any) {
            setError(err.message)
            setIsValid(false)
        }
    }

    const handleSave = () => {
        try {
            const parsed = JSON.parse(value)
            onSave(parsed)
        } catch (err) {
            // Should not happen due to validation but safe to have
        }
    }

    return (
        <div className="space-y-4">
            {(label || description) && (
                <div className="space-y-1">
                    {label && <h3 className="text-sm font-semibold">{label}</h3>}
                    {description && <p className="text-xs text-muted-foreground">{description}</p>}
                </div>
            )}

            <div className="relative">
                <Textarea
                    value={value}
                    onChange={handleChange}
                    rows={rows}
                    className={`text-sm bg-slate-950 text-slate-50 border-2 focus-visible:ring-0 ${isValid ? "border-slate-800" : "border-red-500"
                        }`}
                />
                <div className="absolute bottom-2 right-2 flex items-center gap-2">
                    {!isValid && (
                        <span className="text-[10px] text-red-400 bg-red-950/50 px-2 py-0.5 rounded border border-red-900">
                            JSON Inválido
                        </span>
                    )}
                    {isValid && (
                        <span className="text-[10px] text-green-400 bg-green-950/50 px-2 py-0.5 rounded border border-green-900">
                            Sintaxis Correcta
                        </span>
                    )}
                </div>
            </div>

            {error && (
                <Alert variant="destructive" className="py-2">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle className="text-xs">Error de Formato</AlertTitle>
                    <AlertDescription className="text-[10px]">
                        {error}
                    </AlertDescription>
                </Alert>
            )}

            <Button
                onClick={handleSave}
                disabled={!isValid}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
            >
                Guardar Configuración
            </Button>
        </div>
    )
}
