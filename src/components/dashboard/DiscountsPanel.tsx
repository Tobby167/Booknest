"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import type React from "react";
import { Edit2, Eye, EyeOff, Plus, Trash2 } from "lucide-react";
import { BookNestLoader } from "@/components/BookNestLoader";
import { currencyFor, dateLabel } from "@/lib/format";
import type { Business, ClientGroup, DiscountAudience, ServiceDiscount } from "@/lib/types";

type ServiceSummary = { id: string; name: string };
type OptionSummary = { id: string; service_id: string; name: string };

type DiscountWithRedemptions = ServiceDiscount & {
  service_discount_redemptions?: {
    id: string;
    client_name: string | null;
    client_email: string | null;
    client_phone: string | null;
    original_total: number | null;
    discount_amount: number | null;
    final_total: number | null;
    created_at: string;
  }[];
};

type DiscountsData = {
  business: Business | null;
  discounts: DiscountWithRedemptions[];
  services: ServiceSummary[];
  options: OptionSummary[];
  groups: ClientGroup[];
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

function discountLabel(discount: ServiceDiscount, currency: string) {
  if (discount.discount_type === "percent") return `${discount.discount_value}% off`;
  if (discount.discount_type === "special_price") return `Special price ${currencyFor(discount.discount_value, currency)}`;
  return `${currencyFor(discount.discount_value, currency)} off`;
}

export function DiscountsPanel() {
  const [data, setData] = useState<DiscountsData>({ business: null, discounts: [], services: [], options: [], groups: [] });
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formVersion, setFormVersion] = useState(0);
  const businessCurrency = data.business?.currency || "USD";

  async function load() {
    setLoading(true);
    const response = await fetch("/api/discounts");
    const payload = await response.json();
    setData(response.ok ? payload : { business: null, discounts: [], services: [], options: [], groups: [] });
    setMessage(response.ok ? "" : payload.error || "Discounts could not be loaded.");
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const editing = useMemo(() => data.discounts.find((discount) => discount.id === editingId) ?? null, [data.discounts, editingId]);
  const servicesById = useMemo(() => new Map(data.services.map((service) => [service.id, service])), [data.services]);
  const optionsById = useMemo(() => new Map(data.options.map((option) => [option.id, option])), [data.options]);

  async function save(endpoint: string, payload: Record<string, unknown>, method: "POST" | "PUT") {
    const response = await fetch(endpoint, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const result = await response.json();
    setMessage(response.ok ? "Discount saved." : result.error || "Discount could not be saved.");
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
      service_id: String(formData.get("service_id") || ""),
      service_option_id: String(formData.get("service_option_id") || "") || null,
      name: String(formData.get("name") || ""),
      description: String(formData.get("description") || ""),
      discount_type: String(formData.get("discount_type") || "percent"),
      discount_value: Number(formData.get("discount_value") || 0),
      audience: String(formData.get("audience") || "everyone"),
      target_client_group_id: String(formData.get("target_client_group_id") || "") || null,
      starts_at: toIsoOrNull(formData.get("starts_at")),
      ends_at: toIsoOrNull(formData.get("ends_at")),
      max_redemptions: numOrNull(formData.get("max_redemptions")),
      is_active: checkbox(formData, "is_active")
    };
    await save(`/api/discounts${editingId ? `/${editingId}` : ""}`, payload, editingId ? "PUT" : "POST");
  }

  async function toggleActive(discount: ServiceDiscount) {
    if (!data.business) return;
    await save(`/api/discounts/${discount.id}`, { ...discount, business_id: data.business.id, is_active: !discount.is_active }, "PUT");
  }

  async function remove(discount: ServiceDiscount) {
    if (!window.confirm("Delete this service discount permanently? You can make it inactive instead if you may use it later.")) return;
    const response = await fetch(`/api/discounts/${discount.id}`, { method: "DELETE" });
    const result = await response.json();
    setMessage(response.ok ? "Discount deleted." : result.error || "Discount could not be deleted.");
    if (response.ok) await load();
  }

  if (loading) return <BookNestLoader label="Loading discounts" />;

  if (!data.business) {
    return (
      <div className="card p-6">
        <h1 className="text-2xl font-black text-ink">Create your business first</h1>
        <p className="mt-2 text-ink/65">Discounts belong to a business profile.</p>
        {message ? <p className="mt-4 rounded-lg bg-purple-50 p-3 text-sm font-bold text-purple-700">{message}</p> : null}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-ink">Discounts</h1>
          <p className="mt-1 text-sm text-ink/60">Automatic service-specific discounts. Coupons are still for public fastest-finger codes.</p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => {
            setEditingId(null);
            setFormVersion((current) => current + 1);
          }}
          type="button"
        >
          <Plus className="h-4 w-4" /> New discount
        </button>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,390px)_minmax(0,1fr)]">
        <section className="rounded-xl border border-slate-300 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-black text-ink">{editing ? "Edit discount" : "Add discount"}</h2>
          <p className="mt-1 text-sm text-ink/60">{data.business.name}</p>
          <DiscountForm editing={editing} formVersion={formVersion} groups={data.groups} onSubmit={submit} options={data.options} services={data.services} />
        </section>

        <section className="overflow-hidden rounded-xl border border-slate-300 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <h2 className="text-xl font-black text-ink">Service discounts</h2>
            <span className="text-xs font-black text-slate-400">{data.discounts.length} discounts</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-left text-sm">
              <thead className="bg-slate-50 text-xs font-black text-slate-500">
                <tr>
                  <th className="px-5 py-3">Discount</th>
                  <th className="px-5 py-3">Service</th>
                  <th className="px-5 py-3">Value</th>
                  <th className="px-5 py-3">Rules</th>
                  <th className="px-5 py-3">Used</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.discounts.map((discount) => {
                  const service = servicesById.get(discount.service_id);
                  const option = discount.service_option_id ? optionsById.get(discount.service_option_id) : null;
                  const uses = discount.service_discount_redemptions?.length ?? 0;
                  return (
                    <tr className="hover:bg-slate-50/70" key={discount.id}>
                      <td className="px-5 py-4">
                        <p className="font-black text-ink">{discount.name}</p>
                        <p className="mt-1 text-xs font-bold text-slate-500">{discount.description || "Automatic discount"}</p>
                      </td>
                      <td className="px-5 py-4">
                        <p className="font-black text-ink">{service?.name ?? "Service"}</p>
                        <p className="mt-1 text-xs font-bold text-slate-500">{option ? option.name : "All options"}</p>
                      </td>
                      <td className="px-5 py-4 font-black text-purple-600">{discountLabel(discount, businessCurrency)}</td>
                      <td className="px-5 py-4 text-xs font-bold text-slate-500">
                        <p>{discount.audience === "client_group" ? data.groups.find((group) => group.id === discount.target_client_group_id)?.name ?? "Client group" : discount.audience.replaceAll("_", " ")}</p>
                        {discount.starts_at || discount.ends_at ? (
                          <p>
                            {discount.starts_at ? dateLabel(discount.starts_at.slice(0, 10)) : "Now"} - {discount.ends_at ? dateLabel(discount.ends_at.slice(0, 10)) : "No end"}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-5 py-4 font-black text-ink">
                        {uses}
                        {discount.max_redemptions ? ` / ${discount.max_redemptions}` : ""}
                      </td>
                      <td className="px-5 py-4">
                        <span className={`rounded-full px-3 py-1 text-xs font-black ${discount.is_active ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-500"}`}>
                          {discount.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-2">
                          <button className="rounded-lg border border-slate-200 p-2 hover:border-purple-300" onClick={() => setEditingId(discount.id)} title="Edit" type="button">
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button className="rounded-lg border border-slate-200 p-2 hover:border-purple-300" onClick={() => toggleActive(discount)} title={discount.is_active ? "Make inactive" : "Make active"} type="button">
                            {discount.is_active ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                          <button className="rounded-lg border border-slate-200 p-2 text-rose-600 hover:border-rose-300" onClick={() => remove(discount)} title="Delete" type="button">
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
          {data.discounts.length === 0 ? <p className="p-5 text-center font-bold text-ink/60">No service discounts yet.</p> : null}
        </section>
      </div>
      {message ? <p className="rounded-lg bg-purple-50 p-3 text-sm font-bold text-purple-700">{message}</p> : null}
    </div>
  );
}

function DiscountForm({
  editing,
  formVersion,
  groups,
  onSubmit,
  options,
  services
}: {
  editing: DiscountWithRedemptions | null;
  formVersion: number;
  groups: ClientGroup[];
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  options: OptionSummary[];
  services: ServiceSummary[];
}) {
  const [serviceId, setServiceId] = useState(editing?.service_id ?? "");
  const [audience, setAudience] = useState<DiscountAudience>(editing?.audience ?? "everyone");
  const serviceOptions = options.filter((option) => option.service_id === serviceId);

  useEffect(() => {
    setServiceId(editing?.service_id ?? "");
  }, [editing?.id, formVersion, editing?.service_id]);

  useEffect(() => {
    setAudience(editing?.audience ?? "everyone");
  }, [editing?.id, formVersion, editing?.audience]);

  return (
    <form className="mt-5 grid gap-3" key={editing?.id ?? `new-discount-${formVersion}`} onSubmit={onSubmit}>
      <Select defaultValue={editing?.service_id ?? ""} label="Service" name="service_id" onChange={(event) => setServiceId(event.target.value)} required>
        <option value="">Choose service</option>
        {services.map((service) => (
          <option key={service.id} value={service.id}>
            {service.name}
          </option>
        ))}
      </Select>
      <Select defaultValue={editing?.service_option_id ?? ""} label="Specific option" name="service_option_id">
        <option value="">All service options</option>
        {serviceOptions.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </Select>
      <Input defaultValue={editing?.name ?? ""} label="Discount name" name="name" placeholder="Model price" required />
      <Textarea defaultValue={editing?.description ?? ""} label="Description" name="description" />
      <div className="grid gap-3 sm:grid-cols-2">
        <Select defaultValue={editing?.discount_type ?? "percent"} label="Discount type" name="discount_type">
          <option value="percent">Percent off</option>
          <option value="fixed">Fixed amount off</option>
          <option value="special_price">Special price</option>
        </Select>
        <Input defaultValue={editing?.discount_value ?? 10} label="Value" min={0} name="discount_value" step="0.01" type="number" required />
      </div>
      <Select label="Who gets it" name="audience" value={audience} onChange={(event) => setAudience(event.target.value as DiscountAudience)}>
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
      <Input defaultValue={editing?.max_redemptions ?? ""} label="Total use limit" min={1} name="max_redemptions" type="number" />
      <label className="flex items-center gap-3 rounded-lg border border-ink/10 bg-white p-3 font-bold">
        <input defaultChecked={editing?.is_active ?? true} name="is_active" type="checkbox" />
        Active
      </label>
      <button className="btn btn-primary">{editing ? "Update discount" : "Add discount"}</button>
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
