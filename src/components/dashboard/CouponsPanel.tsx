"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import type React from "react";
import { Check, Edit2, Eye, EyeOff, Plus, Trash2, X } from "lucide-react";
import { BookNestLoader } from "@/components/BookNestLoader";
import { currencyFor, dateLabel } from "@/lib/format";
import type { Business, ClientGroup, Coupon, CouponAudience } from "@/lib/types";

type ServiceSummary = { id: string; name: string };
type OptionSummary = { id: string; service_id: string; name: string };

type CouponWithRedemptions = Coupon & {
  coupon_redemptions?: {
    id: string;
    appointment_id: string | null;
    client_name: string | null;
    client_email: string | null;
    client_phone: string | null;
    original_total: number | null;
    discount_amount: number | null;
    final_total: number | null;
    status: string;
    created_at: string;
  }[];
};

type CouponData = {
  business: Business | null;
  coupons: CouponWithRedemptions[];
  groups: ClientGroup[];
  services: ServiceSummary[];
  options: OptionSummary[];
};

function checkbox(formData: FormData, name: string) {
  return formData.get(name) === "on";
}

function numOrNull(value: FormDataEntryValue | null) {
  if (value == null || String(value).trim() === "") return null;
  return Number(value);
}

function localDateTime(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 16);
}

function toIsoOrNull(value: FormDataEntryValue | null) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function discountLabel(coupon: Coupon, currency: string) {
  return coupon.discount_type === "percent" ? `${coupon.discount_value}% off` : `${currencyFor(coupon.discount_value, currency)} off`;
}

export function CouponsPanel() {
  const [data, setData] = useState<CouponData>({ business: null, coupons: [], groups: [], services: [], options: [] });
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formVersion, setFormVersion] = useState(0);
  const businessCurrency = data.business?.currency || "USD";
  const servicesById = useMemo(() => new Map(data.services.map((service) => [service.id, service])), [data.services]);
  const optionsById = useMemo(() => new Map(data.options.map((option) => [option.id, option])), [data.options]);

  async function load() {
    setLoading(true);
    const response = await fetch("/api/coupons");
    const payload = await response.json();
    setData(payload);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const editing = useMemo(() => data.coupons.find((coupon) => coupon.id === editingId) ?? null, [data.coupons, editingId]);

  async function save(endpoint: string, payload: Record<string, unknown>, method: "POST" | "PUT") {
    const response = await fetch(endpoint, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const result = await response.json();
    setMessage(response.ok ? "Coupon saved." : result.error || "Coupon could not be saved.");
    if (response.ok) {
      setEditingId(null);
      setFormVersion((current) => current + 1);
      await load();
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!data.business) return;
    const formData = new FormData(event.currentTarget);
    const payload = {
      business_id: data.business.id,
      service_id: String(formData.get("service_id") || "") || null,
      service_option_id: String(formData.get("service_option_id") || "") || null,
      code: String(formData.get("code") || ""),
      name: String(formData.get("name") || ""),
      description: String(formData.get("description") || ""),
      discount_type: String(formData.get("discount_type") || "percent"),
      discount_value: Number(formData.get("discount_value") || 0),
      audience: String(formData.get("audience") || "everyone"),
      target_client_group_id: String(formData.get("target_client_group_id") || "") || null,
      requires_login: checkbox(formData, "requires_login"),
      requires_owner_approval: checkbox(formData, "requires_owner_approval"),
      starts_at: toIsoOrNull(formData.get("starts_at")),
      ends_at: toIsoOrNull(formData.get("ends_at")),
      max_redemptions: numOrNull(formData.get("max_redemptions")),
      max_redemptions_per_client: Number(formData.get("max_redemptions_per_client") || 1),
      is_active: checkbox(formData, "is_active")
    };
    await save(`/api/coupons${editingId ? `/${editingId}` : ""}`, payload, editingId ? "PUT" : "POST");
  }

  async function toggleActive(coupon: Coupon) {
    if (!data.business) return;
    await save(
      `/api/coupons/${coupon.id}`,
      {
        ...coupon,
        business_id: data.business.id,
        is_active: !coupon.is_active
      },
      "PUT"
    );
  }

  async function remove(coupon: Coupon) {
    if (!window.confirm("Delete this coupon permanently? You can make it inactive instead if you may use it later.")) return;
    const response = await fetch(`/api/coupons/${coupon.id}`, { method: "DELETE" });
    const result = await response.json();
    setMessage(response.ok ? "Coupon deleted." : result.error || "Coupon could not be deleted.");
    if (response.ok) await load();
  }

  async function updateRedemptionStatus(redemptionId: string, status: "applied" | "rejected") {
    const response = await fetch(`/api/coupons/redemptions/${redemptionId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status })
    });
    const result = await response.json();
    setMessage(response.ok ? `Coupon use ${status === "applied" ? "approved" : "rejected"}.` : result.error || "Coupon use could not be updated.");
    if (response.ok) await load();
  }

  if (loading) return <BookNestLoader label="Loading coupons" />;

  if (!data.business) {
    return (
      <div className="card p-6">
        <h1 className="text-2xl font-black text-ink">Create your business first</h1>
        <p className="mt-2 text-ink/65">Coupons belong to a business profile.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-ink">Coupons</h1>
          <p className="mt-1 text-sm text-ink/60">Create discounts, new-client offers, and model/special-person coupon rules.</p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => {
            setEditingId(null);
            setFormVersion((current) => current + 1);
            setMessage("");
          }}
          type="button"
        >
          <Plus className="h-4 w-4" /> New coupon
        </button>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-black text-ink">{editing ? "Edit coupon" : "Add coupon"}</h2>
          <p className="mt-1 text-sm text-ink/60">{data.business.name}</p>
          <CouponForm editing={editing} formVersion={formVersion} groups={data.groups} onSubmit={submit} options={data.options} services={data.services} />
        </section>

        <section className="overflow-hidden rounded-xl border border-slate-300 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <h2 className="text-xl font-black text-ink">Coupon list</h2>
            <span className="text-xs font-black text-slate-400">{data.coupons.length} coupons</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="bg-slate-50 text-xs font-black text-slate-500">
                <tr>
                  <th className="px-5 py-3">Code</th>
                  <th className="px-5 py-3">Discount</th>
                  <th className="px-5 py-3">Applies to</th>
                  <th className="px-5 py-3">Rules</th>
                  <th className="px-5 py-3">Used</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.coupons.map((coupon) => {
                  const uses = coupon.coupon_redemptions?.filter((item) => item.status !== "rejected").length ?? 0;
                  return (
                    <tr className="hover:bg-slate-50/70" key={coupon.id}>
                      <td className="px-5 py-4">
                        <p className="font-black text-ink">{coupon.code}</p>
                        <p className="mt-1 text-xs font-bold text-slate-500">{coupon.name}</p>
                      </td>
                      <td className="px-5 py-4 font-black text-purple-600">{discountLabel(coupon, businessCurrency)}</td>
                      <td className="px-5 py-4">
                        <p className="font-black text-ink">{coupon.service_id ? servicesById.get(coupon.service_id)?.name ?? "Selected service" : "All services"}</p>
                        <p className="mt-1 text-xs font-bold text-slate-500">{coupon.service_option_id ? optionsById.get(coupon.service_option_id)?.name ?? "Selected option" : coupon.service_id ? "All options" : "Any service/option"}</p>
                      </td>
                      <td className="px-5 py-4 text-xs font-bold text-slate-500">
                        <p>{coupon.audience === "client_group" ? data.groups.find((group) => group.id === coupon.target_client_group_id)?.name ?? "Client group" : coupon.audience.replaceAll("_", " ")}</p>
                        <p>{coupon.requires_login ? "Login required" : "Guest allowed"}</p>
                        <p>{coupon.requires_owner_approval ? "Owner approval" : "Auto apply"}</p>
                        {coupon.starts_at || coupon.ends_at ? (
                          <p>
                            {coupon.starts_at ? dateLabel(coupon.starts_at.slice(0, 10)) : "Now"} - {coupon.ends_at ? dateLabel(coupon.ends_at.slice(0, 10)) : "No end"}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-5 py-4 font-black text-ink">
                        {uses}
                        {coupon.max_redemptions ? ` / ${coupon.max_redemptions}` : ""}
                      </td>
                      <td className="px-5 py-4">
                        <span className={`rounded-full px-3 py-1 text-xs font-black ${coupon.is_active ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-500"}`}>
                          {coupon.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-2">
                          <button className="rounded-lg border border-slate-200 p-2 hover:border-purple-300" onClick={() => setEditingId(coupon.id)} type="button" title="Edit">
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button className="rounded-lg border border-slate-200 p-2 hover:border-purple-300" onClick={() => toggleActive(coupon)} type="button" title={coupon.is_active ? "Make inactive" : "Make active"}>
                            {coupon.is_active ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                          <button className="rounded-lg border border-slate-200 p-2 text-rose-600 hover:border-rose-300" onClick={() => remove(coupon)} type="button" title="Delete">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {data.coupons.length === 0 ? <p className="p-5 text-center font-bold text-ink/60">No coupons yet.</p> : null}
        </section>
      </div>
      <section className="overflow-hidden rounded-xl border border-slate-300 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-xl font-black text-ink">Coupon usage</h2>
            <p className="mt-1 text-sm text-ink/60">Review who used each coupon and approve or reject pending special uses.</p>
          </div>
          <span className="text-xs font-black text-slate-400">
            {data.coupons.reduce((total, coupon) => total + (coupon.coupon_redemptions?.length ?? 0), 0)} uses
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="bg-slate-50 text-xs font-black text-slate-500">
              <tr>
                <th className="px-5 py-3">Coupon</th>
                <th className="px-5 py-3">Client</th>
                <th className="px-5 py-3">Original</th>
                <th className="px-5 py-3">Discount</th>
                <th className="px-5 py-3">Final</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Review</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.coupons.flatMap((coupon) =>
                (coupon.coupon_redemptions ?? []).map((redemption) => (
                  <tr className="hover:bg-slate-50/70" key={redemption.id}>
                    <td className="px-5 py-4">
                      <p className="font-black text-ink">{coupon.code}</p>
                      <p className="mt-1 text-xs font-bold text-slate-500">{coupon.name}</p>
                    </td>
                    <td className="px-5 py-4">
                      <p className="font-black text-ink">{redemption.client_name || "Client"}</p>
                      <p className="mt-1 text-xs font-bold text-slate-500">{redemption.client_email || redemption.client_phone || "No contact saved"}</p>
                    </td>
                    <td className="px-5 py-4 font-bold text-slate-600">{currencyFor(redemption.original_total, businessCurrency)}</td>
                    <td className="px-5 py-4 font-black text-emerald-600">-{currencyFor(redemption.discount_amount, businessCurrency)}</td>
                    <td className="px-5 py-4 font-black text-ink">{currencyFor(redemption.final_total, businessCurrency)}</td>
                    <td className="px-5 py-4">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-black capitalize ${
                          redemption.status === "applied"
                            ? "bg-emerald-50 text-emerald-600"
                            : redemption.status === "rejected"
                              ? "bg-rose-50 text-rose-600"
                              : "bg-amber-50 text-amber-600"
                        }`}
                      >
                        {redemption.status.replaceAll("_", " ")}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-2">
                        {redemption.status === "pending_owner_approval" ? (
                          <>
                            <button
                              className="rounded-lg border border-emerald-200 p-2 text-emerald-600 hover:bg-emerald-50"
                              onClick={() => updateRedemptionStatus(redemption.id, "applied")}
                              title="Approve coupon use"
                              type="button"
                            >
                              <Check className="h-4 w-4" />
                            </button>
                            <button
                              className="rounded-lg border border-rose-200 p-2 text-rose-600 hover:bg-rose-50"
                              onClick={() => updateRedemptionStatus(redemption.id, "rejected")}
                              title="Reject coupon use"
                              type="button"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </>
                        ) : (
                          <span className="text-xs font-black text-slate-400">Reviewed</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {data.coupons.every((coupon) => !coupon.coupon_redemptions?.length) ? (
          <p className="p-5 text-center font-bold text-ink/60">No coupon usage yet.</p>
        ) : null}
      </section>
      {message ? <p className="rounded-lg bg-purple-50 p-3 text-sm font-bold text-purple-700">{message}</p> : null}
    </div>
  );
}

function CouponForm({
  editing,
  formVersion,
  groups,
  options,
  onSubmit,
  services
}: {
  editing: CouponWithRedemptions | null;
  formVersion: number;
  groups: ClientGroup[];
  options: OptionSummary[];
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  services: ServiceSummary[];
}) {
  const [audience, setAudience] = useState<CouponAudience>(editing?.audience ?? "everyone");
  const [serviceId, setServiceId] = useState(editing?.service_id ?? "");
  const serviceOptions = options.filter((option) => option.service_id === serviceId);

  useEffect(() => {
    setAudience(editing?.audience ?? "everyone");
  }, [editing?.id, formVersion, editing?.audience]);

  useEffect(() => {
    setServiceId(editing?.service_id ?? "");
  }, [editing?.id, formVersion, editing?.service_id]);

  return (
    <form className="mt-5 grid gap-3" key={editing?.id ?? `new-coupon-${formVersion}`} onSubmit={onSubmit}>
      <div className="rounded-xl border border-purple-200 bg-purple-50 p-3 text-sm font-bold leading-6 text-ink/70">
        Coupons are code-based promos. Use the limits below for fastest-finger offers, and use service targeting when a code should only work for one service or option.
      </div>
      <Input defaultValue={editing?.code ?? ""} label="Coupon code" name="code" placeholder="NEW10" required />
      <Input defaultValue={editing?.name ?? ""} label="Name" name="name" placeholder="New client discount" required />
      <Textarea defaultValue={editing?.description ?? ""} label="Description" name="description" />
      <Select defaultValue={editing?.service_id ?? ""} label="Applies to service" name="service_id" onChange={(event) => setServiceId(event.target.value)}>
        <option value="">All services</option>
        {services.map((service) => (
          <option key={service.id} value={service.id}>
            {service.name}
          </option>
        ))}
      </Select>
      <Select defaultValue={editing?.service_option_id ?? ""} disabled={!serviceId} label="Specific option" name="service_option_id">
        <option value="">All options</option>
        {serviceOptions.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </Select>
      <div className="grid gap-3 sm:grid-cols-2">
        <Select defaultValue={editing?.discount_type ?? "percent"} label="Discount type" name="discount_type">
          <option value="percent">Percent</option>
          <option value="fixed">Fixed amount</option>
        </Select>
        <Input defaultValue={editing?.discount_value ?? 10} label="Discount value" min={0} name="discount_value" step="0.01" type="number" required />
      </div>
      <Select label="Who can use it" name="audience" value={audience} onChange={(event) => setAudience(event.target.value as CouponAudience)}>
        <option value="everyone">Everyone</option>
        <option value="new_clients">New clients only</option>
        <option value="models">Models</option>
        <option value="special_people">Special people</option>
        <option value="client_group">A saved client group</option>
      </Select>
      {audience === "client_group" ? (
        <Select defaultValue={editing?.target_client_group_id ?? ""} label="Client group" name="target_client_group_id" required>
          <option value="">Choose group</option>
          {groups.map((group) => (
            <option key={group.id} value={group.id}>
              {group.name}
            </option>
          ))}
        </Select>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <Input defaultValue={localDateTime(editing?.starts_at ?? null)} label="Start date/time" name="starts_at" type="datetime-local" />
        <Input defaultValue={localDateTime(editing?.ends_at ?? null)} label="End date/time" name="ends_at" type="datetime-local" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Input defaultValue={editing?.max_redemptions ?? ""} label="Total use limit" min={1} name="max_redemptions" type="number" />
        <Input defaultValue={editing?.max_redemptions_per_client ?? 1} label="Uses per client" min={1} name="max_redemptions_per_client" type="number" />
      </div>
      <label className="flex items-center gap-3 rounded-lg border border-ink/10 bg-white p-3 font-bold">
        <input defaultChecked={editing?.requires_login ?? false} name="requires_login" type="checkbox" />
        Require client login
      </label>
      <label className="flex items-center gap-3 rounded-lg border border-ink/10 bg-white p-3 font-bold">
        <input defaultChecked={editing?.requires_owner_approval ?? false} name="requires_owner_approval" type="checkbox" />
        Owner must approve use
      </label>
      <label className="flex items-center gap-3 rounded-lg border border-ink/10 bg-white p-3 font-bold">
        <input defaultChecked={editing?.is_active ?? true} name="is_active" type="checkbox" />
        Active
      </label>
      <button className="btn btn-primary">{editing ? "Update coupon" : "Add coupon"}</button>
    </form>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  const { label, ...inputProps } = props;
  return (
    <label>
      <span className="label">{label}</span>
      <input className="input focus-ring" {...inputProps} />
    </label>
  );
}

function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string }) {
  const { label, ...textareaProps } = props;
  return (
    <label>
      <span className="label">{label}</span>
      <textarea className="input focus-ring min-h-20" {...textareaProps} />
    </label>
  );
}

function Select(props: React.SelectHTMLAttributes<HTMLSelectElement> & { label: string }) {
  const { label, children, ...selectProps } = props;
  return (
    <label>
      <span className="label">{label}</span>
      <select className="input focus-ring" {...selectProps}>
        {children}
      </select>
    </label>
  );
}
