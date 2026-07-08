"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ForbiddenSettingsPage() {
    const router = useRouter();
    useEffect(() => {
        router.replace("/dashboard");
    }, [router]);

    return (
        <div className="flex h-[50vh] items-center justify-center text-muted-foreground font-semibold">
            Redireccionando al dashboard...
        </div>
    );
}
