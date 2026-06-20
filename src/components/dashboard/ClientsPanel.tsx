"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Check, Edit2, Plus, Trash2, X } from "lucide-react";
import { BookNestLoader } from "@/components/BookNestLoader";
import { dateLabel, timeLabel } from "@/lib/format";
import type { BusinessClientType, ClientGroup } from "@/lib/types";

type ClientRow = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  auth_user_id?: string | null;
  client_type?: BusinessClientType;
  is_approved?: boolean;
  client_group_members?: { client_group_id: string }[];
  appointments?: { id: string; appointment_date: string; start_time: string; status: string }[];
};

type ClientPayload = {
  name: string;
  email: string;
  phone: string;
  client_type: BusinessClientType;
  is_approved: boolean;
  group_ids: string[];
};

const blankClient: ClientPayload = {
  name: "",
  email: "",
  phone: "",
  client_type: "regular",
  is_approved: false,
  group_ids: []
};

function groupIds(client: ClientRow) {
  return (client.client_group_members ?? []).map((member) => member.client_group_id);
}

export function ClientsPanel() {
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [groups, setGroups] = useState<ClientGroup[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ClientPayload>(blankClient);
  const [groupName, setGroupName] = useState("");
  const [groupDescription, setGroupDescription] = useState("");

  async function load() {
    const response = await fetch("/api/dashboard/clients");
    const data = await response.json();
    setClients(data.clients ?? []);
    setGroups(data.groups ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const editing = useMemo(() => clients.find((client) => client.id === editingId) ?? null, [clients, editingId]);

  useEffect(() => {
    if (!editing) {
      setForm(blankClient);
      return;
    }
    setForm({
      name: editing.name,
      email: editing.email ?? "",
      phone: editing.phone ?? "",
      client_type: editing.client_type ?? "regular",
      is_approved: Boolean(editing.is_approved),
      group_ids: groupIds(editing)
    });
  }, [editing]);

  const filtered = useMemo(() => {
    return clients.filter((client) => {
      const groupNames = groupIds(client)
        .map((id) => groups.find((group) => group.id === id)?.name ?? "")
        .join(" ");
      return `${client.name} ${client.email ?? ""} ${client.phone ?? ""} ${groupNames}`.toLowerCase().includes(search.toLowerCase());
    });
  }, [clients, groups, search]);

  async function saveClient(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const response = await fetch(`/api/dashboard/clients${editingId ? `/${editingId}` : ""}`, {
      method: editingId ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form)
    });
    const data = await response.json();
    setMessage(response.ok ? "Client saved." : data.error || "Client could not be saved.");
    if (response.ok) {
      setEditingId(null);
      setForm(blankClient);
      await load();
    }
  }

  async function updateClient(client: ClientRow, patch: Partial<ClientPayload>) {
    const response = await fetch(`/api/dashboard/clients/${client.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch)
    });
    const data = await response.json();
    if (response.ok) {
      setClients((current) => current.map((item) => (item.id === client.id ? { ...item, ...data.client } : item)));
      await load();
    } else {
      setMessage(data.error || "Client could not be updated.");
    }
  }

  async function removeClient(client: ClientRow) {
    if (!window.confirm("Delete this client permanently?")) return;
    const response = await fetch(`/api/dashboard/clients/${client.id}`, { method: "DELETE" });
    const data = await response.json();
    setMessage(response.ok ? "Client deleted." : data.error || "Client could not be deleted.");
    if (response.ok) await load();
  }

  async function createGroup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const response = await fetch("/api/dashboard/client-groups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: groupName, description: groupDescription })
    });
    const data = await response.json();
    setMessage(response.ok ? "Group created." : data.error || "Group could not be created.");
    if (response.ok) {
      setGroupName("");
      setGroupDescription("");
      await load();
    }
  }

  async function removeGroup(group: ClientGroup) {
    if (!window.confirm(`Delete ${group.name}? Clients will stay saved, but this group will be removed.`)) return;
    const response = await fetch(`/api/dashboard/client-groups/${group.id}`, { method: "DELETE" });
    const data = await response.json();
    setMessage(response.ok ? "Group deleted." : data.error || "Group could not be deleted.");
    if (response.ok) await load();
  }

  function toggleFormGroup(groupId: string) {
    setForm((current) => ({
      ...current,
      group_ids: current.group_ids.includes(groupId)
        ? current.group_ids.filter((id) => id !== groupId)
        : [...current.group_ids, groupId]
    }));
  }

  if (loading) return <BookNestLoader label="Loading clients" />;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-ink">Clients</h1>
          <p className="mt-1 text-sm text-ink/60">Register clients, approve special people, and organize them into groups for coupons and discounts.</p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => {
            setEditingId(null);
            setForm(blankClient);
          }}
          type="button"
        >
          <Plus className="h-4 w-4" /> Add Client
        </button>
      </div>

      <div className="grid gap-5 xl:grid-cols-[390px_1fr]">
        <section className="rounded-xl border border-slate-300 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-black text-ink">{editing ? "Edit client" : "Register client"}</h2>
          <form className="mt-4 grid gap-3" onSubmit={saveClient}>
            <label>
              <span className="label">Name</span>
              <input className="input focus-ring" required value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
            </label>
            <label>
              <span className="label">Email</span>
              <input className="input focus-ring" type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} />
            </label>
            <label>
              <span className="label">Phone</span>
              <input className="input focus-ring" value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} />
            </label>
            <label>
              <span className="label">Client type</span>
              <select className="input focus-ring" value={form.client_type} onChange={(event) => setForm((current) => ({ ...current, client_type: event.target.value as BusinessClientType }))}>
                <option value="regular">Regular</option>
                <option value="new_client">New client</option>
                <option value="model">Model</option>
                <option value="special_person">Special person</option>
                <option value="vip">VIP</option>
              </select>
            </label>
            <div className="rounded-lg border border-slate-200 p-3">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Groups</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {groups.map((group) => (
                  <button
                    className={`rounded-full border px-3 py-1.5 text-xs font-black ${form.group_ids.includes(group.id) ? "border-purple-500 bg-purple-50 text-purple-700" : "border-slate-200 text-slate-600"}`}
                    key={group.id}
                    onClick={() => toggleFormGroup(group.id)}
                    type="button"
                  >
                    {form.group_ids.includes(group.id) ? <Check className="mr-1 inline h-3 w-3" /> : null}
                    {group.name}
                  </button>
                ))}
                {!groups.length ? <span className="text-sm font-bold text-slate-500">Create a group below first.</span> : null}
              </div>
            </div>
            <label className="flex items-center gap-3 rounded-lg border border-slate-200 p-3 font-bold">
              <input checked={form.is_approved} onChange={(event) => setForm((current) => ({ ...current, is_approved: event.target.checked }))} type="checkbox" />
              Approved for model/special offers
            </label>
            <button className="btn btn-primary">{editing ? "Update client" : "Add client"}</button>
            {editing ? (
              <button className="btn btn-secondary" onClick={() => setEditingId(null)} type="button">
                Cancel edit
              </button>
            ) : null}
          </form>

          <form className="mt-6 grid gap-3 border-t border-slate-200 pt-5" onSubmit={createGroup}>
            <h3 className="font-black text-ink">Create group</h3>
            <input className="input focus-ring" placeholder="Models, VIPs, June promo..." required value={groupName} onChange={(event) => setGroupName(event.target.value)} />
            <textarea className="input focus-ring min-h-20" placeholder="Optional note" value={groupDescription} onChange={(event) => setGroupDescription(event.target.value)} />
            <button className="btn btn-secondary" type="submit">
              <Plus className="h-4 w-4" /> Add group
            </button>
            <div className="flex flex-wrap gap-2">
              {groups.map((group) => (
                <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-black text-slate-600" key={group.id}>
                  {group.name}
                  <button className="text-rose-500" onClick={() => removeGroup(group)} title="Delete group" type="button">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          </form>
        </section>

        <section className="space-y-4">
          <div className="rounded-xl border border-slate-300 bg-white p-4 shadow-sm">
            <input className="input focus-ring max-w-md" placeholder="Search clients or groups..." value={search} onChange={(event) => setSearch(event.target.value)} />
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-300 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-left text-sm">
                <thead className="bg-slate-50 text-xs font-black text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Client</th>
                    <th className="px-4 py-3">Phone</th>
                    <th className="px-4 py-3">Email</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Groups</th>
                    <th className="px-4 py-3">Total Bookings</th>
                    <th className="px-4 py-3">Last Appointment</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((client) => {
                    const appointments = client.appointments ?? [];
                    const lastAppointment = appointments
                      .slice()
                      .sort((a, b) => `${b.appointment_date}${b.start_time}`.localeCompare(`${a.appointment_date}${a.start_time}`))[0];
                    const names = groupIds(client)
                      .map((id) => groups.find((group) => group.id === id)?.name)
                      .filter(Boolean);
                    return (
                      <tr className="hover:bg-slate-50/70" key={client.id}>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-3">
                            <span className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-purple-500 to-fuchsia-500 text-xs font-black text-white">
                              {client.name
                                .split(" ")
                                .map((part) => part[0])
                                .join("")
                                .slice(0, 2)
                                .toUpperCase()}
                            </span>
                            <span>
                              <span className="block font-black text-ink">{client.name}</span>
                              {client.is_approved ? <span className="text-xs font-black text-emerald-600">Approved</span> : null}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-slate-600">{client.phone || "-"}</td>
                        <td className="px-4 py-4 text-slate-600">{client.email || "-"}</td>
                        <td className="px-4 py-4">
                          <div className="flex flex-wrap items-center gap-2">
                            <select
                              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-black text-ink"
                              onChange={(event) => updateClient(client, { client_type: event.target.value as BusinessClientType })}
                              value={client.client_type ?? "regular"}
                            >
                              <option value="regular">Regular</option>
                              <option value="new_client">New client</option>
                              <option value="model">Model</option>
                              <option value="special_person">Special</option>
                              <option value="vip">VIP</option>
                            </select>
                            <label className="flex items-center gap-1 text-xs font-black text-slate-500">
                              <input
                                checked={Boolean(client.is_approved)}
                                onChange={(event) => updateClient(client, { is_approved: event.target.checked })}
                                type="checkbox"
                              />
                              Approved
                            </label>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex flex-wrap gap-1">
                            {names.map((name) => (
                              <span className="rounded-full bg-purple-50 px-2 py-1 text-xs font-black text-purple-700" key={name}>
                                {name}
                              </span>
                            ))}
                            {!names.length ? <span className="text-xs font-bold text-slate-400">No group</span> : null}
                          </div>
                        </td>
                        <td className="px-4 py-4 font-black text-ink">{appointments.length}</td>
                        <td className="px-4 py-4 text-slate-600">
                          {lastAppointment ? `${dateLabel(lastAppointment.appointment_date)} at ${timeLabel(lastAppointment.start_time)}` : "-"}
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex justify-end gap-2">
                            <button className="rounded-lg border border-slate-200 p-2 hover:border-purple-300" onClick={() => setEditingId(client.id)} title="Edit" type="button">
                              <Edit2 className="h-4 w-4" />
                            </button>
                            <button className="rounded-lg border border-slate-200 p-2 text-rose-600 hover:border-rose-300" onClick={() => removeClient(client)} title="Delete" type="button">
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
            <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-xs font-bold text-slate-500">
              <span>
                Showing {filtered.length} of {clients.length} clients
              </span>
              <span>{groups.length} groups</span>
            </div>
          </div>
          {filtered.length === 0 ? <p className="rounded-xl border border-slate-200 bg-white p-5 text-center font-bold text-ink/60">No clients found.</p> : null}
        </section>
      </div>
      {message ? <p className="rounded-lg bg-purple-50 p-3 text-sm font-bold text-purple-700">{message}</p> : null}
    </div>
  );
}
