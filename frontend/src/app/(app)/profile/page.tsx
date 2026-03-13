"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { useToast } from "@/hooks/use-toast";
import { getUserRates, updateUserRates, getCompanies } from "@/lib/api/settings";
import { getAvailableCompanies, joinCompany, getMyCompanies } from "@/lib/api/companies";
import { updateMe, changePassword } from "@/lib/api/users";
import { useAuth } from "@/context/AuthContext";
import { Company, UserCompanyRate } from "@/lib/types";

// User Info Form
const userFormSchema = z.object({
  first_name: z.string().min(2),
  last_name: z.string().min(2),
  default_company_id: z.string().optional(),
});

const passwordSchema = z.object({
  current_password: z.string().min(1, "Current password is required"),
  new_password: z.string().min(6, "New password must be at least 6 characters"),
  confirm_password: z.string().min(6, "Confirm password must be at least 6 characters"),
}).refine((data) => data.new_password === data.confirm_password, {
  message: "Passwords don't match",
  path: ["confirm_password"],
});

const rateFormSchema = z.object({
  hourlyRate: z.coerce.number().min(0),
  dailyRate: z.coerce.number().min(0),
  nightRate: z.coerce.number().min(0),
  coordinationRate: z.coerce.number().min(0),
  isGross: z.boolean().default(true),
  deductionSs: z.coerce.number().min(0).max(100).optional(),
  deductionIrpf: z.coerce.number().min(0).max(100).default(0),
  deductionExtra: z.coerce.number().min(0).max(100).default(0),
});

type RateFormValues = z.infer<typeof rateFormSchema>;

export default function ProfilePage() {
  const { user, checkAuth } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("");

  // Queries


  const { data: availableCompanies = [] } = useQuery({
    queryKey: ["availableCompanies"],
    queryFn: getAvailableCompanies,
  });

  const { data: myCompanies = [] } = useQuery({
    queryKey: ["myCompanies"],
    queryFn: getMyCompanies,
  });

  // Auto-select default company
  useEffect(() => {
    if (!selectedCompanyId && user?.default_company_id && myCompanies.find((c: Company) => c.id === user.default_company_id)) {
      setSelectedCompanyId(user.default_company_id);
    }
  }, [user, myCompanies, selectedCompanyId]);

  const currentCompany = myCompanies.find((c: Company) => c.id === selectedCompanyId);
  const companySettings = currentCompany?.settings || {};
  const allowedRates = companySettings.allowed_rates as string[] | undefined;


  const { data: rates, isLoading: isLoadingRates } = useQuery({
    queryKey: ["rates", selectedCompanyId],
    queryFn: () => getUserRates(selectedCompanyId),
    enabled: !!selectedCompanyId,
  });

  // ... inside render ...

  <div className="mb-6">
    <Label className="mb-2 block">Select Company</Label>
    <Select value={selectedCompanyId} onValueChange={setSelectedCompanyId}>
      <SelectTrigger className="w-[280px]">
        <SelectValue placeholder="Select a company" />
      </SelectTrigger>
      <SelectContent>
        {myCompanies
          .map((company: Company) => (
            <SelectItem key={company.id} value={company.id}>
              {company.name}
            </SelectItem>
          ))}
      </SelectContent>
    </Select>
  </div>

  // Forms
  const userForm = useForm({
    resolver: zodResolver(userFormSchema),
    defaultValues: {
      first_name: user?.first_name || "",
      last_name: user?.last_name || "",
      default_company_id: user?.default_company_id || "",
    }
  });

  const rateForm = useForm<RateFormValues>({
    resolver: zodResolver(rateFormSchema),
    defaultValues: {
      hourlyRate: 0,
      dailyRate: 0,
      nightRate: 0,
      coordinationRate: 0,
      isGross: true,
      deductionSs: undefined,
      deductionIrpf: 0,
      deductionExtra: 0,
    }
  });

  const passwordForm = useForm({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      current_password: "",
      new_password: "",
      confirm_password: "",
    }
  });

  // Sync user form
  useEffect(() => {
    if (user) {
      userForm.reset({
        first_name: user.first_name || "",
        last_name: user.last_name || "",
        default_company_id: user.default_company_id || "",
      });
    }
  }, [user, userForm]);

  // Sync rate form
  useEffect(() => {
    if (rates && rates.length > 0) {
      const rate = rates[0];
      rateForm.reset({
        hourlyRate: rate.hourlyRate || 0,
        dailyRate: rate.dailyRate || 0,
        nightRate: rate.nightRate || 0,
        coordinationRate: rate.coordinationRate || 0,
        isGross: rate.isGross !== undefined ? rate.isGross : true,
        deductionSs: rate.deductionSs !== undefined ? rate.deductionSs * 100 : undefined,
        deductionIrpf: (rate.deductionIrpf || 0) * 100,
        deductionExtra: (rate.deductionExtra || 0) * 100,
      });
    } else {
      rateForm.reset({
        hourlyRate: 0,
        dailyRate: 0,
        nightRate: 0,
        coordinationRate: 0,
        isGross: true,
        deductionSs: undefined,
        deductionIrpf: 0,
        deductionExtra: 0,
      });
    }
  }, [rates, rateForm]);

  // Mutations
  const userMutation = useMutation({
    mutationFn: (values: { first_name: string; last_name: string; default_company_id?: string }) => updateMe(values),
    onSuccess: async () => {
      await checkAuth();
      toast({ title: "Profile updated" });
    },
    onError: () => toast({ title: "Failed to update profile", variant: "destructive" }),
  });

  const passwordMutation = useMutation({
    mutationFn: (values: any) => changePassword({
      current_password: values.current_password,
      new_password: values.new_password
    }),
    onSuccess: () => {
      toast({ title: "Password updated successfully" });
      passwordForm.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update password",
        description: error.response?.data?.detail || "Please check your current password",
        variant: "destructive"
      });
    },
  });

  const joinMutation = useMutation({
    mutationFn: (companyId: string) => joinCompany(companyId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["availableCompanies"] });
      toast({ title: "Request sent", description: "Wait for admin approval." });
    },
    onError: () => toast({ title: "Failed to join", variant: "destructive" }),
  });

  const rateMutation = useMutation({
    mutationFn: (values: any) => updateUserRates(values),
    onSuccess: () => {
      toast({ title: "Rates updated" });
      queryClient.invalidateQueries({ queryKey: ["rates", selectedCompanyId] });
    },
    onError: () => toast({ title: "Failed to update rates", variant: "destructive" }),
  });

  function onRateSubmit(data: RateFormValues) {
    if (!selectedCompanyId) {
      toast({ title: "Please select a company first", variant: "destructive" });
      return;
    }

    const payload = {
      companyId: selectedCompanyId,
      hourlyRate: data.hourlyRate,
      dailyRate: data.dailyRate,
      nightRate: data.nightRate,
      coordinationRate: data.coordinationRate,
      isGross: data.isGross,
      deductionSs: data.deductionSs !== undefined ? data.deductionSs / 100 : undefined,
      deductionIrpf: data.deductionIrpf / 100,
      deductionExtra: data.deductionExtra / 100
    };

    rateMutation.mutate(payload);
  }

  function onUserSubmit(data: { first_name: string; last_name: string; default_company_id?: string }) {
    userMutation.mutate(data);
  }

  if (isLoadingRates) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
      <div className="flex items-center justify-between">
        <h1 className="font-semibold text-lg md:text-2xl">Profile</h1>
        <Button variant="outline" onClick={() => router.push("/login")}>
          Logout
        </Button>
      </div>

      <div className="grid gap-6">
        {/* User Info Section */}
        <Card>
          <CardHeader>
            <CardTitle>User Information</CardTitle>
            <CardDescription>Update your personal details.</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...userForm}>
              <form onSubmit={userForm.handleSubmit(onUserSubmit)} className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={userForm.control}
                  name="first_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First Name</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={userForm.control}
                  name="last_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last Name</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={userForm.control}
                  name="default_company_id"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>Default Company</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || ""} disabled={myCompanies.length === 0}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select default company" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {myCompanies.map((c: any) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>This company will be selected by default when adding a work log.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="md:col-span-2">
                  <Button type="submit" disabled={userMutation.isPending}>
                    {userMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save Details
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>

        {/* Password Change Section */}
        <Card>
          <CardHeader>
            <CardTitle>Change Password</CardTitle>
            <CardDescription>Ensure your account is using a long, random password to stay secure.</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...passwordForm}>
              <form onSubmit={passwordForm.handleSubmit((data) => passwordMutation.mutate(data))} className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={passwordForm.control}
                  name="current_password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Current Password</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="******" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="hidden md:block"></div> {/* Spacer */}

                <FormField
                  control={passwordForm.control}
                  name="new_password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>New Password</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="******" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={passwordForm.control}
                  name="confirm_password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirm New Password</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="******" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="md:col-span-2">
                  <Button type="submit" disabled={passwordMutation.isPending} variant="outline">
                    {passwordMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Update Password
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>

        <Tabs defaultValue="rates">
          <TabsList>
            <TabsTrigger value="rates">Company Rates</TabsTrigger>
            <TabsTrigger value="companies">Company Membership</TabsTrigger>
          </TabsList>

          <TabsContent value="rates">
            {/* Rates Section */}
            <Card>
              <CardHeader>
                <CardTitle>Company Rates</CardTitle>
                <CardDescription>Manage your rates for each company.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mb-6">
                  <Label className="mb-2 block">Select Company</Label>
                  <Select value={selectedCompanyId} onValueChange={setSelectedCompanyId}>
                    <SelectTrigger className="w-[280px]">
                      <SelectValue placeholder="Select a company" />
                    </SelectTrigger>
                    <SelectContent>
                      {myCompanies
                        .map((company: Company) => (
                          <SelectItem key={company.id} value={company.id}>
                            {company.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>

                <Form {...rateForm}>
                  <form className="space-y-8" onSubmit={rateForm.handleSubmit(onRateSubmit)}>
                    <div className="grid gap-4 md:grid-cols-2">
                      {(!allowedRates || allowedRates.includes("hourly")) && (
                        <FormField
                          control={rateForm.control}
                          name="hourlyRate"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Hourly Rate (€/h)</FormLabel>
                              <FormControl><Input type="number" {...field} /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}

                      {(!allowedRates || allowedRates.includes("night")) && (
                        <FormField
                          control={rateForm.control}
                          name="nightRate"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Night Rate (€/night)</FormLabel>
                              <FormControl><Input type="number" {...field} /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}

                      {(!allowedRates || allowedRates.includes("daily")) && (
                        <FormField
                          control={rateForm.control}
                          name="dailyRate"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Daily Rate (€/day)</FormLabel>
                              <FormControl><Input type="number" {...field} /></FormControl>
                              <FormDescription>Used for Tutorial/Days</FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}

                      {(!allowedRates || allowedRates.includes("coordination")) && (
                        <FormField
                          control={rateForm.control}
                          name="coordinationRate"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Coordination Rate (€)</FormLabel>
                              <FormControl><Input type="number" {...field} /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}
                    </div>

                    <div className="space-y-4 border-t pt-4">
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <h3 className="text-base font-semibold">Tax Settings</h3>
                          <p className="text-sm text-muted-foreground">Configure deductions for your rates.</p>
                        </div>
                        <FormField
                          control={rateForm.control}
                          name="isGross"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-center gap-2 space-y-0">
                              <FormLabel className="text-base">Prices are Gross</FormLabel>
                              <FormControl>
                                <Switch
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </div>

                      {rateForm.watch("isGross") && (
                        <div className="grid gap-4 md:grid-cols-3">
                          <FormField
                            control={rateForm.control}
                            name="deductionSs"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Social Security (SS) (%)</FormLabel>
                                <FormControl>
                                  <Input
                                    type="number"
                                    step="0.0001"
                                    placeholder={(currentCompany as any)?.social_security_deduction ? `Default: ${((currentCompany as any).social_security_deduction * 100).toFixed(2)}` : "0"}
                                    {...field}
                                    value={field.value ?? ""}
                                    onChange={e => field.onChange(e.target.value === "" ? undefined : Number(e.target.value))}
                                  />
                                </FormControl>
                                <FormDescription>
                                  Leave empty to use Company Default ({(currentCompany as any)?.social_security_deduction ? ((currentCompany as any).social_security_deduction * 100).toFixed(2) : 0}%)
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={rateForm.control}
                            name="deductionIrpf"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>IRPF (%)</FormLabel>
                                <FormControl><Input type="number" step="0.0001" {...field} /></FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={rateForm.control}
                            name="deductionExtra"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Extra (%)</FormLabel>
                                <FormControl><Input type="number" step="0.0001" {...field} /></FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      )}
                    </div>

                    <Button disabled={rateMutation.isPending} type="submit">
                      {rateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Save Rates
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="companies">
            <Card>
              <CardHeader>
                <CardTitle>Available Companies</CardTitle>
                <CardDescription>Join new companies to log work.</CardDescription>
              </CardHeader>
              <CardContent>
                {availableCompanies.length === 0 ? (
                  <p className="text-muted-foreground">No new companies available.</p>
                ) : (
                  <div className="grid gap-4">
                    {availableCompanies.map((c: any) => (
                      <div key={c.id} className="flex items-center justify-between border p-4 rounded-md">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{c.name}</span>
                          {c.membership_status === 'rejected' && (
                            <Badge variant="destructive">Rejected</Badge>
                          )}
                        </div>
                        <Button size="sm" onClick={() => joinMutation.mutate(c.id)} disabled={joinMutation.isPending}>
                          {c.membership_status === 'rejected' ? 'Request to Re-join' : 'Request to Join'}
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
