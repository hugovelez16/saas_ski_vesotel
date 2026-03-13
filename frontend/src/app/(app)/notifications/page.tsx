"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getNotifications, markNotificationRead } from "@/lib/api/users";
import { format, parseISO } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bell, Check, Loader2, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

export default function NotificationsPage() {
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const { data: notifications = [], isLoading } = useQuery({
        queryKey: ["notifications"],
        queryFn: getNotifications,
    });

    const readMutation = useMutation({
        mutationFn: markNotificationRead,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["notifications"] });
            toast({ title: "Marked as read" });
        },
    });

    if (isLoading) return <div className="p-8"><Loader2 className="animate-spin" /></div>;

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-2">
                <Bell className="h-6 w-6" />
                <h1 className="text-3xl font-bold tracking-tight">Notifications</h1>
            </div>

            <div className="grid gap-4">
                {notifications.length === 0 ? (
                    <Card>
                        <CardContent className="p-8 text-center text-muted-foreground">
                            No new notifications.
                        </CardContent>
                    </Card>
                ) : (
                    notifications.map((notif: any) => (
                        <Card key={notif.id} className="transition-all hover:bg-muted/10">
                            <CardContent className="p-4 flex gap-4 items-start">
                                <div className={`p-2 rounded-full ${notif.type === 'warning' ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'}`}>
                                    {notif.type === 'warning' ? <Info className="h-5 w-5" /> : <Bell className="h-5 w-5" />}
                                </div>
                                <div className="flex-1 space-y-1">
                                    <p className="text-sm font-medium leading-none">
                                        {notif.message}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        {format(parseISO(notif.created_at), "PPP p")}
                                    </p>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => readMutation.mutate(notif.id)}
                                    title="Mark as read"
                                >
                                    <Check className="h-4 w-4" />
                                </Button>
                            </CardContent>
                        </Card>
                    ))
                )}
            </div>
        </div>
    );
}
