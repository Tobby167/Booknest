"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import type React from "react";
import Link from "next/link";
import { Edit2, Eye, EyeOff, Plus, Trash2, X } from "lucide-react";
import { BookNestLoader } from "@/components/BookNestLoader";
import { priceLabel } from "@/lib/format";
import type { Business, Service, ServiceAddon, ServiceCategory, ServiceOption } from "@/lib/types";

type CatalogData = {
  business: Business | null;
  categories: ServiceCategory[];
  services: Service[];
  options: ServiceOption[];
  addons: ServiceAddon[];
};

type Tab = "categories" | "services" | "options" | "addons";

const tabs: { id: Tab; label: string }[] = [
  { id: "categories", label: "Categories" },
  { id: "services", label: "Services" },
  { id: "options", label: "Options" },
  { id: "addons", label: "Add-ons" }
];

const singularLabels: Record<Tab, string> = {
  categories: "Category",
  services: "Service",
  options: "Option",
  addons: "Add-on"
};

function numOrNull(value: FormDataEntryValue | null) {
  if (value == null || String(value).trim() === "") return null;
  return Number(value);
}

function checkbox(formData: FormData, name: string) {
  return formData.get(name) === "on";
}

export function CatalogManager({ initialTab = "services" }: { initialTab?: Tab }) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [catalog, setCatalog] = useState<CatalogData>({ business: null, categories: [], services: [], options: [], addons: [] });
  const [message, setMessage] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formVersion, setFormVersion] = useState(0);
  const [loading, setLoading] = useState(true);
  const businessCurrency = catalog.business?.currency || "USD";
  const activeTabLabel = tabs.find((item) => item.id === tab)?.label ?? "Items";
  const activeItemLabel = activeTabLabel.replace(/s$/, "");

  async function load() {
    setLoading(true);
    const response = await fetch("/api/dashboard/catalog");
    const data = await response.json();
    setCatalog(data);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const editing = useMemo(() => {
    if (!editingId) return null;
    if (tab === "categories") return catalog.categories.find((item) => item.id === editingId);
    if (tab === "services") return catalog.services.find((item) => item.id === editingId);
    if (tab === "options") return catalog.options.find((item) => item.id === editingId);
    return catalog.addons.find((item) => item.id === editingId);
  }, [catalog, editingId, tab]);

  if (loading) return <BookNestLoader label="Loading dashboard" />;

  if (!catalog.business) {
    return (
      <div className="card p-6">
        <h1 className="text-2xl font-black text-ink">Create your business first</h1>
        <p className="mt-2 text-ink/65">Services belong to a business profile.</p>
        <Link className="btn btn-primary mt-5" href="/dashboard/settings">
          Open settings
        </Link>
      </div>
    );
  }

  async function submitCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!catalog.business) return;
    const formData = new FormData(event.currentTarget);
    const payload = {
      business_id: catalog.business.id,
      name: String(formData.get("name")),
      description: String(formData.get("description") || ""),
      display_order: Number(formData.get("display_order") || 0),
      is_active: checkbox(formData, "is_active")
    };
    await save(`/api/service-categories${editingId ? `/${editingId}` : ""}`, payload);
  }

  async function submitService(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!catalog.business) return;
    const formData = new FormData(event.currentTarget);
    const payload = {
      business_id: catalog.business.id,
      category_id: String(formData.get("category_id") || "") || null,
      name: String(formData.get("name")),
      description: String(formData.get("description") || ""),
      base_price: numOrNull(formData.get("base_price")),
      price_type: String(formData.get("price_type")),
      duration_minutes: numOrNull(formData.get("duration_minutes")),
      deposit_required: checkbox(formData, "deposit_required"),
      deposit_amount: numOrNull(formData.get("deposit_amount")),
      buffer_before_minutes: Number(formData.get("buffer_before_minutes") || 0),
      buffer_after_minutes: Number(formData.get("buffer_after_minutes") || 0),
      display_order: Number(formData.get("display_order") || 0),
      is_active: checkbox(formData, "is_active")
    };
    await save(`/api/services${editingId ? `/${editingId}` : ""}`, payload);
  }

  async function submitOption(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!catalog.business) return;
    const formData = new FormData(event.currentTarget);
    const payload = {
      business_id: catalog.business.id,
      service_id: String(formData.get("service_id")),
      name: String(formData.get("name")),
      description: String(formData.get("description") || ""),
      price: numOrNull(formData.get("price")),
      price_type: String(formData.get("price_type")),
      duration_minutes: numOrNull(formData.get("duration_minutes")),
      display_order: Number(formData.get("display_order") || 0),
      is_active: checkbox(formData, "is_active")
    };
    await save(`/api/service-options${editingId ? `/${editingId}` : ""}`, payload);
  }

  async function submitAddon(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!catalog.business) return;
    const formData = new FormData(event.currentTarget);
    const payload = {
      business_id: catalog.business.id,
      service_id: String(formData.get("service_id")),
      name: String(formData.get("name")),
      description: String(formData.get("description") || ""),
      price: numOrNull(formData.get("price")),
      price_type: String(formData.get("price_type")),
      duration_minutes: Number(formData.get("duration_minutes") || 0),
      is_active: checkbox(formData, "is_active")
    };
    await save(`/api/service-addons${editingId ? `/${editingId}` : ""}`, payload);
  }

  async function save(endpoint: string, payload: Record<string, unknown>) {
    const response = await fetch(endpoint, {
      method: editingId ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    setMessage(response.ok ? "Catalog saved." : data.error || "Catalog could not be saved.");
    if (response.ok) {
      setEditingId(null);
      setFormOpen(false);
      setFormVersion((current) => current + 1);
      await load();
    }
  }

  async function setActive(endpoint: string, isActive: boolean) {
    const response = await fetch(endpoint, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: isActive })
    });
    const data = await response.json();
    setMessage(response.ok ? (isActive ? "Item is active." : "Item is inactive.") : data.error || "Item could not be updated.");
    if (response.ok) await load();
  }

  async function remove(endpoint: string) {
    if (!window.confirm("Delete this permanently? If it has appointment history, BookNest will keep it and ask you to make it inactive instead.")) return;
    const response = await fetch(endpoint, { method: "DELETE" });
    const data = await response.json();
    setMessage(response.ok ? "Item deleted." : data.error || "Item could not be deleted.");
    if (response.ok) await load();
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-ink">Service Catalog</h1>
          <p className="mt-1 text-sm text-ink/60">Manage categories, services, options, and add-ons for your booking page.</p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => {
            setEditingId(null);
            setFormVersion((current) => current + 1);
            setMessage("");
            setFormOpen(true);
          }}
          type="button"
        >
          <Plus className="h-4 w-4" /> New {activeItemLabel}
        </button>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white px-4 pt-4 shadow-sm">
        <div className="flex flex-wrap gap-7 border-b border-slate-100">
          {tabs.map((item) => (
            <button
              className={`border-b-2 px-1 pb-3 text-sm font-black ${
                tab === item.id ? "border-purple-600 text-purple-600" : "border-transparent text-slate-500 hover:text-ink"
              }`}
              key={item.id}
              onClick={() => {
                setTab(item.id);
                setEditingId(null);
                setFormOpen(false);
                setFormVersion((current) => current + 1);
                setMessage("");
              }}
              type="button"
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid min-w-0 gap-5">
        <section className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <h2 className="text-xl font-black text-ink">{activeTabLabel}</h2>
            <span className="text-xs font-black text-slate-400">
              {tab === "categories"
                ? `${catalog.categories.length} items`
                : tab === "services"
                  ? `${catalog.services.length} items`
                  : tab === "options"
                    ? `${catalog.options.length} items`
                    : `${catalog.addons.length} items`}
            </span>
          </div>
          <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-slate-50 text-xs font-black text-slate-500">
              <tr>
                <th className="px-5 py-3">Name</th>
                <th className="px-5 py-3">Description</th>
                <th className="px-5 py-3">Details</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
          {tab === "categories"
            ? catalog.categories.map((category) => (
                <CatalogRow
                  description={category.description || ""}
                  isActive={category.is_active}
                  key={category.id}
                  meta={`Order ${category.display_order} | ${category.is_active ? "Active" : "Inactive"}`}
                  onDelete={() => remove(`/api/service-categories/${category.id}`)}
                  onEdit={() => {
                    setEditingId(category.id);
                    setFormOpen(true);
                    setMessage("");
                  }}
                  onToggleActive={() => setActive(`/api/service-categories/${category.id}`, !category.is_active)}
                  title={category.name}
                />
              ))
            : null}
          {tab === "services"
            ? catalog.services.map((service) => (
                <CatalogRow
                  description={service.description || ""}
                  isActive={service.is_active}
                  key={service.id}
                  meta={`${priceLabel(service.price_type, service.base_price, businessCurrency)} | ${service.duration_minutes ?? 60} min | ${service.is_active ? "Active" : "Inactive"}`}
                  onDelete={() => remove(`/api/services/${service.id}`)}
                  onEdit={() => {
                    setEditingId(service.id);
                    setFormOpen(true);
                    setMessage("");
                  }}
                  onToggleActive={() => setActive(`/api/services/${service.id}`, !service.is_active)}
                  title={service.name}
                />
              ))
            : null}
          {tab === "options"
            ? catalog.options.map((option) => (
                <CatalogRow
                  description={catalog.services.find((service) => service.id === option.service_id)?.name || ""}
                  isActive={option.is_active}
                  key={option.id}
                  meta={`${priceLabel(option.price_type, option.price, businessCurrency)} | ${option.duration_minutes ?? "service"} min | ${option.is_active ? "Active" : "Inactive"}`}
                  onDelete={() => remove(`/api/service-options/${option.id}`)}
                  onEdit={() => {
                    setEditingId(option.id);
                    setFormOpen(true);
                    setMessage("");
                  }}
                  onToggleActive={() => setActive(`/api/service-options/${option.id}`, !option.is_active)}
                  title={option.name}
                />
              ))
            : null}
          {tab === "addons"
            ? catalog.addons.map((addon) => (
                <CatalogRow
                  description={catalog.services.find((service) => service.id === addon.service_id)?.name || ""}
                  isActive={addon.is_active}
                  key={addon.id}
                  meta={`${priceLabel(addon.price_type, addon.price, businessCurrency)} | +${addon.duration_minutes} min | ${addon.is_active ? "Active" : "Inactive"}`}
                  onDelete={() => remove(`/api/service-addons/${addon.id}`)}
                  onEdit={() => {
                    setEditingId(addon.id);
                    setFormOpen(true);
                    setMessage("");
                  }}
                  onToggleActive={() => setActive(`/api/service-addons/${addon.id}`, !addon.is_active)}
                  title={addon.name}
                />
              ))
            : null}
            </tbody>
          </table>
        </div>
      </section>
      </div>
      {formOpen ? (
        <div className="fixed inset-0 z-[70] bg-slate-950/55 backdrop-blur-sm" onClick={() => setFormOpen(false)}>
          <section
            aria-label={`${editingId ? "Edit" : "Add"} ${activeItemLabel}`}
            className="fixed inset-y-0 right-0 flex w-full max-w-xl flex-col overflow-hidden bg-white shadow-2xl sm:border-l sm:border-slate-200"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-purple-600">{catalog.business.name}</p>
                <h2 className="mt-1 text-2xl font-black text-ink">
                  {editingId ? "Edit" : "Add"} {activeItemLabel}
                </h2>
                <p className="mt-1 text-sm font-semibold text-slate-600">Complete this item, then return to the catalog list.</p>
              </div>
              <button
                aria-label="Close form"
                className="rounded-xl border border-slate-300 p-2 text-slate-900 transition hover:bg-slate-100"
                onClick={() => setFormOpen(false)}
                type="button"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-6">
              {tab === "categories" ? <CategoryForm editing={editing as ServiceCategory | null} formVersion={formVersion} onSubmit={submitCategory} /> : null}
              {tab === "services" ? (
                <ServiceForm business={catalog.business} categories={catalog.categories} editing={editing as Service | null} formVersion={formVersion} onSubmit={submitService} />
              ) : null}
              {tab === "options" ? <OptionForm editing={editing as ServiceOption | null} formVersion={formVersion} onSubmit={submitOption} services={catalog.services} /> : null}
              {tab === "addons" ? <AddonForm editing={editing as ServiceAddon | null} formVersion={formVersion} onSubmit={submitAddon} services={catalog.services} /> : null}
            </div>
          </section>
        </div>
      ) : null}
      {message ? <p className="rounded-lg bg-purple-50 p-3 text-sm font-bold text-purple-700">{message}</p> : null}
    </div>
  );
}

function CategoryForm({
  editing,
  formVersion,
  onSubmit
}: {
  editing: ServiceCategory | null;
  formVersion: number;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form className="grid gap-3" key={editing?.id ?? `new-category-${formVersion}`} onSubmit={onSubmit}>
      <Input defaultValue={editing?.name} label="Name" name="name" required />
      <Textarea defaultValue={editing?.description ?? ""} label="Description" name="description" />
      <Input defaultValue={editing?.display_order ?? 0} label="Display order" name="display_order" type="number" />
      <ActiveCheckbox defaultChecked={editing?.is_active ?? true} />
      <button className="btn btn-primary">{editing ? "Update category" : "Add category"}</button>
    </form>
  );
}

function ServiceForm({
  business,
  categories,
  editing,
  formVersion,
  onSubmit
}: {
  business: Business | null;
  categories: ServiceCategory[];
  editing: Service | null;
  formVersion: number;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const defaultDepositRequired = editing?.deposit_required ?? business?.default_deposit_required ?? false;
  const defaultDepositAmount = editing?.deposit_amount ?? business?.default_deposit_amount ?? "";
  return (
    <form className="grid gap-3" key={editing?.id ?? `new-service-${formVersion}`} onSubmit={onSubmit}>
      <Input defaultValue={editing?.name} label="Name" name="name" required />
      <Select defaultValue={editing?.category_id ?? ""} label="Category" name="category_id">
        <option value="">Uncategorized</option>
        {categories.map((category) => (
          <option key={category.id} value={category.id}>
            {category.name}
          </option>
        ))}
      </Select>
      <Textarea defaultValue={editing?.description ?? ""} label="Notes/instructions" name="description" />
      <Select defaultValue={editing?.price_type ?? "fixed"} label="Price type" name="price_type">
        <option value="fixed">Fixed</option>
        <option value="varies">Price varies</option>
        <option value="free">No extra charge</option>
      </Select>
      <Input defaultValue={editing?.base_price ?? ""} label="Base price" name="base_price" type="number" />
      <Input defaultValue={editing?.duration_minutes ?? 60} label="Duration minutes" name="duration_minutes" type="number" />
      <label className="flex items-center gap-3 rounded-lg border border-ink/10 bg-white p-3 font-bold">
        <input defaultChecked={defaultDepositRequired} name="deposit_required" type="checkbox" />
        Deposit required
      </label>
      <Input defaultValue={defaultDepositAmount} label="Deposit amount" name="deposit_amount" type="number" />
      <div className="grid gap-3 sm:grid-cols-2">
        <Input defaultValue={editing?.buffer_before_minutes ?? 0} label="Buffer before" name="buffer_before_minutes" type="number" />
        <Input defaultValue={editing?.buffer_after_minutes ?? 0} label="Buffer after" name="buffer_after_minutes" type="number" />
      </div>
      <Input defaultValue={editing?.display_order ?? 0} label="Display order" name="display_order" type="number" />
      <ActiveCheckbox defaultChecked={editing?.is_active ?? true} />
      <button className="btn btn-primary">{editing ? "Update service" : "Add service"}</button>
    </form>
  );
}

function OptionForm({
  editing,
  formVersion,
  onSubmit,
  services
}: {
  editing: ServiceOption | null;
  formVersion: number;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  services: Service[];
}) {
  return (
    <form className="grid gap-3" key={editing?.id ?? `new-option-${formVersion}`} onSubmit={onSubmit}>
      <Select defaultValue={editing?.service_id ?? ""} label="Service" name="service_id" required>
        <option value="">Choose service</option>
        {services.map((service) => (
          <option key={service.id} value={service.id}>
            {service.name}
          </option>
        ))}
      </Select>
      <Input defaultValue={editing?.name} label="Option name" name="name" required />
      <Textarea defaultValue={editing?.description ?? ""} label="Description" name="description" />
      <Select defaultValue={editing?.price_type ?? "fixed"} label="Price type" name="price_type">
        <option value="fixed">Fixed</option>
        <option value="varies">Price varies</option>
        <option value="free">No extra charge</option>
      </Select>
      <Input defaultValue={editing?.price ?? ""} label="Price" name="price" type="number" />
      <Input defaultValue={editing?.duration_minutes ?? ""} label="Duration minutes" name="duration_minutes" type="number" />
      <Input defaultValue={editing?.display_order ?? 0} label="Display order" name="display_order" type="number" />
      <ActiveCheckbox defaultChecked={editing?.is_active ?? true} />
      <button className="btn btn-primary">{editing ? "Update option" : "Add option"}</button>
    </form>
  );
}

function AddonForm({
  editing,
  formVersion,
  onSubmit,
  services
}: {
  editing: ServiceAddon | null;
  formVersion: number;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  services: Service[];
}) {
  return (
    <form className="grid gap-3" key={editing?.id ?? `new-addon-${formVersion}`} onSubmit={onSubmit}>
      <Select defaultValue={editing?.service_id ?? ""} label="Service" name="service_id" required>
        <option value="">Choose service</option>
        {services.map((service) => (
          <option key={service.id} value={service.id}>
            {service.name}
          </option>
        ))}
      </Select>
      <Input defaultValue={editing?.name} label="Add-on name" name="name" required />
      <Textarea defaultValue={editing?.description ?? ""} label="Description" name="description" />
      <Select defaultValue={editing?.price_type ?? "fixed"} label="Price type" name="price_type">
        <option value="fixed">Fixed</option>
        <option value="varies">Price varies</option>
        <option value="free">No extra charge</option>
      </Select>
      <Input defaultValue={editing?.price ?? ""} label="Price" name="price" type="number" />
      <Input defaultValue={editing?.duration_minutes ?? 0} label="Extra duration minutes" name="duration_minutes" type="number" />
      <ActiveCheckbox defaultChecked={editing?.is_active ?? true} />
      <button className="btn btn-primary">{editing ? "Update add-on" : "Add add-on"}</button>
    </form>
  );
}

function CatalogRow({
  description,
  isActive,
  meta,
  onDelete,
  onEdit,
  onToggleActive,
  title
}: {
  description: string;
  isActive: boolean;
  meta: string;
  onDelete: () => void;
  onEdit: () => void;
  onToggleActive: () => void;
  title: string;
}) {
  const metaParts = meta.split("|").map((part) => part.trim());
  const status = metaParts.at(-1) ?? "Active";
  const details = metaParts.slice(0, -1).join(" | ") || "-";
  return (
    <tr className="hover:bg-slate-50/70">
      <td className="px-5 py-4 font-black text-ink">{title}</td>
      <td className="max-w-xs px-5 py-4 text-slate-600">{description || "-"}</td>
      <td className="px-5 py-4 text-xs font-black uppercase tracking-[0.08em] text-slate-400">{details}</td>
      <td className="px-5 py-4">
        <span className={`rounded-full px-3 py-1 text-xs font-black ${status.toLowerCase().includes("inactive") ? "bg-slate-100 text-slate-500" : "bg-emerald-50 text-emerald-600"}`}>
          {status}
        </span>
      </td>
      <td className="px-5 py-4">
        <div className="flex justify-end gap-2">
          <button className="rounded-lg border border-slate-200 p-2 hover:border-purple-300" onClick={onEdit} type="button" title="Edit">
            <Edit2 className="h-4 w-4" />
          </button>
          <button
            className="rounded-lg border border-slate-200 p-2 hover:border-purple-300"
            onClick={onToggleActive}
            type="button"
            title={isActive ? "Make inactive" : "Make active"}
          >
            {isActive ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
          <button className="rounded-lg border border-slate-200 p-2 text-rose-600 hover:border-rose-300" onClick={onDelete} type="button" title="Delete permanently">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </td>
    </tr>
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

function ActiveCheckbox({ defaultChecked }: { defaultChecked: boolean }) {
  return (
    <label className="flex items-center gap-3 rounded-lg border border-ink/10 bg-white p-3 font-bold">
      <input defaultChecked={defaultChecked} name="is_active" type="checkbox" />
      Active
    </label>
  );
}
