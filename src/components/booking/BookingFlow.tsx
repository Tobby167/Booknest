"use client";

import { CalendarDays, CalendarPlus, Check, ChevronLeft, ChevronRight, Copy, Download, Mail, Printer, Upload } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { getBookingDurationMinutes, getBookingPrice } from "@/lib/booking/availability";
import { currencyFor, dateLabel, durationLabel, inlinePriceLabel, priceLabel, timeLabel } from "@/lib/format";
import type { BookingCatalog, Service, ServiceAddon, ServiceOption } from "@/lib/types";
import { BookNestLoader } from "@/components/BookNestLoader";

type BookingFlowProps = {
  businessSlug: string;
  embed?: boolean;
};

type Confirmation = {
  appointmentId: string;
  serviceName: string;
  optionName?: string;
  addonNames: string[];
  appointmentDate: string;
  startTime: string;
  endTime: string;
  totalPrice: number | null;
  status: string;
  paymentStatus: string;
  clientName: string;
  clientEmail?: string;
};

type ClientSession = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string;
};

type ServiceDiscountPreview = {
  id: string;
  name: string;
  discount_type: string;
  discount_value: number;
  audience: string;
};

const allowedReceiptTypes = ["image/png", "image/jpeg", "image/webp"];
const maxReceiptBytes = 5 * 1024 * 1024;

function compactCalendarDate(date: string, time: string) {
  const [hours = "00", minutes = "00", seconds = "00"] = time.split(":");
  return `${date.replaceAll("-", "")}T${hours.padStart(2, "0")}${minutes.padStart(2, "0")}${seconds.padStart(2, "0")}`;
}

function isoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function monthKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function addLocalDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function monthLabel(monthValue: string) {
  const [year, month] = monthValue.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString([], { month: "long", year: "numeric" });
}

function calendarCells(monthValue: string) {
  const [year, month] = monthValue.split("-").map(Number);
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0).getDate();
  const blanks = Array.from({ length: firstDay.getDay() }, () => null);
  const days = Array.from({ length: lastDay }, (_, index) => new Date(year, month - 1, index + 1));
  const cells = [...blanks, ...days];
  return [...cells, ...Array.from({ length: Math.max(0, 42 - cells.length) }, () => null)];
}

async function readJsonResponse(response: Response) {
  const text = await response.text();
  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch {
    return { error: text };
  }
}

export function BookingFlow({ businessSlug, embed = false }: BookingFlowProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [catalog, setCatalog] = useState<BookingCatalog | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [optionId, setOptionId] = useState("");
  const [addonIds, setAddonIds] = useState<string[]>([]);
  const [date, setDate] = useState("");
  const [calendarMonth, setCalendarMonth] = useState(() => monthKey(addLocalDays(new Date(), 1)));
  const [slots, setSlots] = useState<string[]>([]);
  const [startTime, setStartTime] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [couponMessage, setCouponMessage] = useState("");
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [couponBusy, setCouponBusy] = useState(false);
  const [appliedCouponCode, setAppliedCouponCode] = useState("");
  const [serviceDiscount, setServiceDiscount] = useState<ServiceDiscountPreview | null>(null);
  const [serviceDiscountAmount, setServiceDiscountAmount] = useState(0);
  const [serviceDiscountMessage, setServiceDiscountMessage] = useState("");
  const [serviceDiscountBusy, setServiceDiscountBusy] = useState(false);
  const [notes, setNotes] = useState("");
  const [formAnswers, setFormAnswers] = useState<Record<string, string>>({});
  const [receipt, setReceipt] = useState<File | null>(null);
  const [paymentMode, setPaymentMode] = useState<"online" | "manual">("manual");
  const [onlinePaymentAvailable, setOnlinePaymentAvailable] = useState(false);
  const [onlinePaymentReason, setOnlinePaymentReason] = useState("Online payment is safely hidden until Stripe is fully configured.");
  const [clientSession, setClientSession] = useState<ClientSession | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const response = await fetch(`/api/business/${businessSlug}`);
        const data = await readJsonResponse(response);
        setLoading(false);

        if (!response.ok) {
          setError(data.error || "Booking page could not be loaded.");
          return;
        }

        setCatalog(data);

        const paymentConfigResponse = await fetch("/api/payments/config");
        const paymentConfig = await readJsonResponse(paymentConfigResponse);
        const stripeEnabled = Boolean(paymentConfigResponse.ok && paymentConfig.stripeEnabled);
        setOnlinePaymentAvailable(stripeEnabled);
        setOnlinePaymentReason(paymentConfig.reason || "Online payment is safely hidden until Stripe is fully configured.");
        setPaymentMode(stripeEnabled ? "online" : "manual");

        const clientResponse = await fetch("/api/client/me");
        const clientData = await readJsonResponse(clientResponse);
        if (clientResponse.ok && clientData.client) {
          setClientSession(clientData.client);
          setClientName((current) => current || clientData.client.full_name || "");
          setClientEmail((current) => current || clientData.client.email || "");
        }
      } catch (loadError) {
        setLoading(false);
        setError(loadError instanceof Error ? loadError.message : "Booking page could not be loaded.");
      }
    }

    load();
  }, [businessSlug]);

  // ── Auth-state listener ──────────────────────────────────────────────────
  // Supabase fires onAuthStateChange immediately with the current session on
  // subscription, so this catches the SIGNED_IN event even when the user
  // navigated away to /client/login and returned via client-side navigation
  // (component not remounted, businessSlug useEffect never re-ran).
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange(async (event) => {
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        try {
          const response = await fetch("/api/client/me");
          const data = await readJsonResponse(response);
          if (response.ok && data.client) {
            setClientSession(data.client);
            setClientName((current) => current || data.client.full_name || "");
            setClientEmail((current) => current || data.client.email || "");
          }
        } catch {
          // Non-fatal: initial load already attempted /api/client/me
        }
      } else if (event === "SIGNED_OUT") {
        setClientSession(null);
      }
    });
    return () => subscription.unsubscribe();
  }, []);
  // ─────────────────────────────────────────────────────────────────────────

  const selectedService = useMemo(
    () => catalog?.services.find((service) => service.id === serviceId) ?? null,
    [catalog?.services, serviceId]
  );
  const selectedOption = useMemo(
    () => catalog?.options.find((option) => option.id === optionId) ?? null,
    [catalog?.options, optionId]
  );
  const selectedAddons = useMemo(
    () => catalog?.addons.filter((addon) => addonIds.includes(addon.id)) ?? [],
    [addonIds, catalog?.addons]
  );
  const serviceOptions = useMemo(
    () => catalog?.options.filter((option) => option.service_id === serviceId) ?? [],
    [catalog?.options, serviceId]
  );
  const serviceAddons = useMemo(
    () => catalog?.addons.filter((addon) => addon.service_id === serviceId) ?? [],
    [catalog?.addons, serviceId]
  );
  const categoriesForBooking = useMemo(() => {
    if (!catalog) return [];
    const categoryIdsWithServices = new Set(catalog.services.map((service) => service.category_id).filter(Boolean));
    return catalog.categories
      .filter((category) => categoryIdsWithServices.has(category.id))
      .slice()
      .sort((left, right) => left.display_order - right.display_order || left.name.localeCompare(right.name));
  }, [catalog]);
  const categoryServices = useMemo(() => {
    if (!catalog || !categoryId) return [];
    return catalog.services
      .filter((service) => service.category_id === categoryId)
      .slice()
      .sort((left, right) => left.display_order - right.display_order || left.name.localeCompare(right.name));
  }, [catalog, categoryId]);
  const selectedCategory = useMemo(
    () => categoriesForBooking.find((category) => category.id === categoryId) ?? null,
    [categoriesForBooking, categoryId]
  );
  const fallbackServices = useMemo(() => {
    if (!catalog) return [];
    const categoryOrder = new Map(catalog.categories.map((category, index) => [category.id, category.display_order ?? index]));
    return catalog.services
      .slice()
      .sort((left, right) => {
        const leftCategory = left.category_id ? (categoryOrder.get(left.category_id) ?? 9999) : 9999;
        const rightCategory = right.category_id ? (categoryOrder.get(right.category_id) ?? 9999) : 9999;
        return leftCategory - rightCategory || left.display_order - right.display_order || left.name.localeCompare(right.name);
      });
  }, [catalog]);
  const totalPrice = selectedService ? getBookingPrice(selectedService, selectedOption, selectedAddons) : null;
  const discountedServiceTotal = totalPrice == null ? null : Math.max(0, Math.round((totalPrice - serviceDiscountAmount) * 100) / 100);
  const finalTotalPrice = discountedServiceTotal == null ? null : Math.max(0, Math.round((discountedServiceTotal - couponDiscount) * 100) / 100);
  const duration = selectedService ? getBookingDurationMinutes(selectedService, selectedOption, selectedAddons) : 0;
  const optionRequired = serviceOptions.length > 0;
  const readyForDetails = Boolean(selectedService) && (!optionRequired || Boolean(selectedOption));
  const canBook =
    Boolean(selectedService) &&
    Boolean(date) &&
    Boolean(startTime) &&
    clientName.trim().length >= 2 &&
    clientPhone.trim().length >= 5 &&
    (!optionRequired || Boolean(selectedOption)) &&
    (paymentMode === "manual" || (onlinePaymentAvailable && finalTotalPrice != null && finalTotalPrice > 0)) &&
    !busy;
  const questions = useMemo(
    () => catalog?.formQuestions?.filter((question) => !question.service_id || question.service_id === serviceId) ?? [],
    [catalog?.formQuestions, serviceId]
  );
  const calendarDays = useMemo(() => calendarCells(calendarMonth), [calendarMonth]);
  const today = useMemo(() => isoDate(new Date()), []);
  const maxBookableDate = useMemo(() => {
    const max = new Date();
    max.setDate(max.getDate() + (catalog?.business.max_advance_booking_days ?? 90));
    return isoDate(max);
  }, [catalog?.business.max_advance_booking_days]);
  const businessCurrency = catalog?.business.currency || "USD";
  const clientReturnPath = pathname || `/book/${businessSlug}`;
  const clientLoginHref = `/client/login?next=${encodeURIComponent(clientReturnPath)}`;
  const clientSignupHref = `/client/signup?next=${encodeURIComponent(clientReturnPath)}`;

  // Derived from the Stripe return URL: /book/[slug]?payment=success&appointment=[id]
  const paymentResult = searchParams.get("payment");
  const appointmentIdFromUrl = searchParams.get("appointment");
  const stripeSessionId = searchParams.get("session_id");

  // ── Stripe return URL handler ─────────────────────────────────────────────
  // After a successful Stripe checkout, the browser is fully redirected back
  // to this page with ?payment=success&appointment=[id]. The component remounts
  // from scratch, so confirmation state is null. This effect fetches the
  // appointment record and populates the existing confirmation UI.
  useEffect(() => {
    if (loading || !catalog || paymentResult !== "success" || !appointmentIdFromUrl) return;
    let cancelled = false;

    async function fetchStripeConfirmation() {
      try {
        const queryParams = new URLSearchParams();
        if (stripeSessionId) queryParams.set("session_id", stripeSessionId);
        const response = await fetch(`/api/appointments/${appointmentIdFromUrl}/confirm?${queryParams.toString()}`);
        const data = await readJsonResponse(response);
        if (cancelled || !response.ok || !data.appointment) return;

        const apt = data.appointment as {
          id: string;
          appointment_date: string;
          start_time: string;
          end_time: string;
          total_price: number | null;
          status: string;
          payment_status: string;
          client_name: string;
          client_email: string | null;
          services: { name: string } | null;
          service_options: { name: string } | null;
        };

        setConfirmation({
          appointmentId: apt.id,
          serviceName: apt.services?.name ?? "Service",
          optionName: apt.service_options?.name,
          addonNames: [],
          appointmentDate: apt.appointment_date,
          startTime: apt.start_time,
          endTime: apt.end_time,
          totalPrice: apt.total_price,
          status: apt.status,
          paymentStatus: apt.payment_status,
          clientName: apt.client_name,
          clientEmail: apt.client_email ?? undefined
        });
      } catch {
        // Non-fatal: confirmation will not display but booking was recorded
      }
    }

    fetchStripeConfirmation();
    return () => {
      cancelled = true;
    };
  }, [loading, catalog, paymentResult, appointmentIdFromUrl]);
  // ─────────────────────────────────────────────────────────────────────────

  function changeCalendarMonth(direction: -1 | 1) {
    const [year, month] = calendarMonth.split("-").map(Number);
    const next = new Date(year, month - 1 + direction, 1);
    setCalendarMonth(monthKey(next));
  }

  useEffect(() => {
    setServiceId("");
    setOptionId("");
    setAddonIds([]);
    setDate("");
    setSlots([]);
    setStartTime("");
    clearServiceDiscount();
    clearCoupon();
  }, [categoryId]);

  useEffect(() => {
    setOptionId("");
    setAddonIds([]);
    setDate("");
    setSlots([]);
    setStartTime("");
    clearServiceDiscount();
    clearCoupon();
  }, [serviceId]);

  useEffect(() => {
    clearServiceDiscount();
    clearCoupon();
  }, [optionId, addonIds]);

  useEffect(() => {
    clearCoupon();
  }, [serviceDiscountAmount]);

  useEffect(() => {
    async function loadSlots(service: Service, option: ServiceOption | null, addons: ServiceAddon[]) {
      const params = new URLSearchParams({
        businessSlug,
        serviceId: service.id,
        date
      });
      if (option?.id) params.set("serviceOptionId", option.id);
      if (addons.length) params.set("addonIds", addons.map((addon) => addon.id).join(","));

      const response = await fetch(`/api/slots?${params.toString()}`);
      const data = await readJsonResponse(response);
      setSlots(response.ok ? data.slots ?? [] : []);
      if (!response.ok) setError(data.error || "Available times could not be loaded.");
    }

    if (!selectedService || !date || (optionRequired && !selectedOption)) {
      setSlots([]);
      return;
    }

    loadSlots(selectedService, selectedOption, selectedAddons);
  }, [businessSlug, date, optionRequired, selectedService, selectedOption, selectedAddons]);

  useEffect(() => {
    if ((!onlinePaymentAvailable || finalTotalPrice == null || finalTotalPrice <= 0) && paymentMode === "online") {
      setPaymentMode("manual");
    }
  }, [finalTotalPrice, onlinePaymentAvailable, paymentMode]);

  useEffect(() => {
    const controller = new AbortController();

    async function previewServiceDiscount() {
      if (!readyForDetails || !selectedService || totalPrice == null) {
        clearServiceDiscount();
        return;
      }

      setServiceDiscountBusy(true);
      try {
        const response = await fetch("/api/discounts/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            businessSlug,
            serviceId: selectedService.id,
            serviceOptionId: selectedOption?.id ?? null,
            totalPrice,
            clientName,
            clientEmail,
            clientPhone
          }),
          signal: controller.signal
        });
        const data = await readJsonResponse(response);
        if (!response.ok || !data.discount) {
          setServiceDiscount(null);
          setServiceDiscountAmount(0);
          setServiceDiscountMessage("");
          return;
        }
        setServiceDiscount(data.discount);
        setServiceDiscountAmount(Number(data.discountAmount || 0));
        setServiceDiscountMessage(data.message || `${data.discount.name} applied.`);
      } catch (previewError) {
        if (previewError instanceof DOMException && previewError.name === "AbortError") return;
        setServiceDiscount(null);
        setServiceDiscountAmount(0);
        setServiceDiscountMessage("");
      } finally {
        if (!controller.signal.aborted) setServiceDiscountBusy(false);
      }
    }

    const timer = window.setTimeout(previewServiceDiscount, 350);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [businessSlug, readyForDetails, selectedService?.id, selectedOption?.id, totalPrice, clientName, clientEmail, clientPhone]);

  function clearServiceDiscount() {
    setServiceDiscount(null);
    setServiceDiscountAmount(0);
    setServiceDiscountMessage("");
    setServiceDiscountBusy(false);
  }

  function clearCoupon() {
    setCouponDiscount(0);
    setCouponMessage("");
    setAppliedCouponCode("");
  }

  async function applyCoupon() {
    if (!catalog || discountedServiceTotal == null) {
      setCouponMessage("Choose a fixed-price booking before using a coupon.");
      return;
    }
    if (!couponCode.trim()) {
      clearCoupon();
      return;
    }
    setCouponBusy(true);
    setCouponMessage("");
    try {
      const response = await fetch("/api/coupons/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessSlug,
          code: couponCode,
          totalPrice: discountedServiceTotal,
          serviceId: selectedService?.id,
          serviceOptionId: selectedOption?.id || null,
          clientName,
          clientEmail,
          clientPhone
        })
      });
      const data = await readJsonResponse(response);
      if (!response.ok) throw new Error(data.error || "Coupon could not be applied.");
      setCouponDiscount(Number(data.discountAmount || 0));
      setAppliedCouponCode(String(data.coupon?.code || couponCode).toUpperCase());
      setCouponMessage(data.message || "Coupon applied.");
    } catch (couponError) {
      setCouponDiscount(0);
      setAppliedCouponCode("");
      setCouponMessage(couponError instanceof Error ? couponError.message : "Coupon could not be applied.");
    } finally {
      setCouponBusy(false);
    }
  }

  function updateReceipt(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    if (!file) {
      setReceipt(null);
      return;
    }
    if (!allowedReceiptTypes.includes(file.type)) {
      setError("Receipt must be PNG, JPG, JPEG, or WebP.");
      return;
    }
    if (file.size > maxReceiptBytes) {
      setError("Receipt must be 5 MB or smaller.");
      return;
    }
    setError("");
    setReceipt(file);
  }

  async function uploadReceiptIfNeeded() {
    if (!receipt || !catalog) return null;
    const formData = new FormData();
    formData.append("file", receipt);
    formData.append("businessId", catalog.business.id);
    formData.append("clientEmail", clientEmail);
    formData.append("clientPhone", clientPhone);
    const response = await fetch("/api/payments/upload-receipt", {
      method: "POST",
      body: formData
    });
    const data = await readJsonResponse(response);
    if (!response.ok) throw new Error(data.error || "Receipt upload failed.");
    return data.receiptUrl as string;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!catalog || !selectedService) return;
    if (serviceOptions.length > 0 && !selectedOption) {
      setError("Choose a service option before booking.");
      return;
    }
    if (clientName.trim().length < 2) {
      setError("Enter your full name before booking.");
      return;
    }
    if (clientPhone.trim().length < 5) {
      setError("Enter a valid phone number before booking.");
      return;
    }
    if (!startTime) {
      setError("Choose an available time slot.");
      return;
    }

    setBusy(true);
    setError("");

    try {
      const receiptImageUrl = await uploadReceiptIfNeeded();
      const response = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessSlug,
          serviceId: selectedService.id,
          serviceOptionId: selectedOption?.id ?? null,
          addonIds,
          appointmentDate: date,
          startTime,
          clientName,
          clientEmail,
          clientPhone,
          couponCode: appliedCouponCode,
          notes,
          receiptImageUrl,
          formAnswers: questions.map((question) => ({
            question_id: question.id,
            answer: formAnswers[question.id] || ""
          }))
        })
      });
      const data = await readJsonResponse(response);

      if (!response.ok) throw new Error(data.error || "Booking could not be created.");

      if (paymentMode === "online") {
        if (!onlinePaymentAvailable) {
          throw new Error("Online payment is not available yet. Please choose manual payment.");
        }

        if (data.booking.total_price == null || Number(data.booking.total_price) <= 0) {
          throw new Error("Online payment requires a fixed price. Please choose manual payment for this booking.");
        }

        const checkoutResponse = await fetch("/api/payments/stripe-checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            appointmentId: data.booking.appointment_id,
            clientEmail,
            clientPhone
          })
        });
        const checkoutData = await readJsonResponse(checkoutResponse);
        if (!checkoutResponse.ok) throw new Error(checkoutData.error || "Online checkout could not be started.");
        window.location.href = checkoutData.checkoutUrl;
        return;
      }

      setConfirmation({
        appointmentId: data.booking.appointment_id,
        serviceName: selectedService.name,
        optionName: selectedOption?.name,
        addonNames: selectedAddons.map((addon) => addon.name),
        appointmentDate: date,
        startTime,
        endTime: data.booking.end_time,
        totalPrice: data.booking.total_price,
        status: data.booking.status,
        paymentStatus: data.booking.payment_status,
        clientName,
        clientEmail
      });
    } catch (bookingError) {
      setError(bookingError instanceof Error ? bookingError.message : "Booking failed.");
    } finally {
      setBusy(false);
    }
  }

  function confirmationText() {
    if (!confirmation || !catalog) return "";
    return [
      `${catalog.business.name} booking confirmation`,
      `Client: ${confirmation.clientName}`,
      `Service: ${confirmation.serviceName}${confirmation.optionName ? ` - ${confirmation.optionName}` : ""}`,
      confirmation.addonNames.length ? `Add-ons: ${confirmation.addonNames.join(", ")}` : null,
      `Date: ${dateLabel(confirmation.appointmentDate)}`,
      `Time: ${timeLabel(confirmation.startTime)} - ${timeLabel(confirmation.endTime)}`,
      `Price: ${currencyFor(confirmation.totalPrice, businessCurrency)}`,
      `Appointment status: ${confirmation.status}`,
      `Payment status: ${confirmation.paymentStatus}`,
      catalog.business.phone ? `Phone: ${catalog.business.phone}` : null,
      catalog.business.email ? `Email: ${catalog.business.email}` : null,
      catalog.business.address ? `Address: ${catalog.business.address}` : null
    ]
      .filter(Boolean)
      .join("\n");
  }

  async function copyConfirmation() {
    await navigator.clipboard.writeText(confirmationText());
  }

  function downloadConfirmation() {
    const blob = new Blob([confirmationText()], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "booking-confirmation.txt";
    link.click();
    URL.revokeObjectURL(url);
  }

  function calendarTitle() {
    if (!confirmation || !catalog) return "BookNest appointment";
    return `${catalog.business.name}: ${confirmation.serviceName}${confirmation.optionName ? ` - ${confirmation.optionName}` : ""}`;
  }

  function calendarDescription() {
    return confirmationText();
  }

  function googleCalendarUrl() {
    if (!confirmation || !catalog) return "#";
    const params = new URLSearchParams({
      action: "TEMPLATE",
      text: calendarTitle(),
      dates: `${compactCalendarDate(confirmation.appointmentDate, confirmation.startTime)}/${compactCalendarDate(confirmation.appointmentDate, confirmation.endTime)}`,
      details: calendarDescription(),
      location: catalog.business.address || catalog.business.name
    });
    return `https://calendar.google.com/calendar/render?${params.toString()}`;
  }

  function downloadCalendarFile() {
    if (!confirmation || !catalog) return;
    const lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//BookNest//Booking Confirmation//EN",
      "BEGIN:VEVENT",
      `UID:${confirmation.appointmentId}@booknest.local`,
      `DTSTAMP:${compactCalendarDate(new Date().toISOString().slice(0, 10), new Date().toISOString().slice(11, 19))}`,
      `DTSTART:${compactCalendarDate(confirmation.appointmentDate, confirmation.startTime)}`,
      `DTEND:${compactCalendarDate(confirmation.appointmentDate, confirmation.endTime)}`,
      `SUMMARY:${calendarTitle().replaceAll("\n", " ")}`,
      `DESCRIPTION:${calendarDescription().replaceAll("\n", "\\n")}`,
      `LOCATION:${(catalog.business.address || catalog.business.name).replaceAll("\n", " ")}`,
      "END:VEVENT",
      "END:VCALENDAR"
    ].join("\r\n");
    const blob = new Blob([lines], { type: "text/calendar" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "booknest-appointment.ics";
    link.click();
    URL.revokeObjectURL(url);
  }

  function emailDetailsUrl() {
    if (!confirmation) return "#";
    const params = new URLSearchParams({
      subject: calendarTitle(),
      body: confirmationText()
    });
    return `mailto:${confirmation.clientEmail || ""}?${params.toString()}`;
  }

  if (loading) {
    return <BookNestLoader label="Loading booking page" />;
  }

  if (error && !catalog) {
    return <div className="card p-6 text-center font-black text-ink">{error}</div>;
  }

  if (!catalog) return null;

  if (confirmation) {
    return (
      <section className="card p-5 sm:p-7">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-fern text-white">
          <Check className="h-6 w-6" />
        </div>
        <h1 className="mt-4 text-2xl font-black text-ink">Booking received</h1>
        <p className="mt-2 text-sm font-semibold leading-6 text-slate-700">
          Keep this confirmation. The business owner can review receipts and confirm or update the appointment from BookNest.
        </p>
        <div className="mt-5 grid gap-3 rounded-lg border border-ink/10 bg-mist p-4 text-sm text-ink/75">
          <p>
            <strong>Service:</strong> {confirmation.serviceName}
            {confirmation.optionName ? ` - ${confirmation.optionName}` : ""}
          </p>
          {confirmation.addonNames.length ? (
            <p>
              <strong>Add-ons:</strong> {confirmation.addonNames.join(", ")}
            </p>
          ) : null}
          <p>
            <strong>Date:</strong> {dateLabel(confirmation.appointmentDate)}
          </p>
          <p>
            <strong>Time:</strong> {timeLabel(confirmation.startTime)} - {timeLabel(confirmation.endTime)}
          </p>
          <p>
            <strong>Price:</strong> {currencyFor(confirmation.totalPrice, businessCurrency)}
          </p>
          {catalog.business.cancellation_policy ? (
            <p>
              <strong>Cancellation policy:</strong> {catalog.business.cancellation_policy}
            </p>
          ) : null}
          <p>
            <strong>Appointment:</strong> {confirmation.status.replaceAll("_", " ")}
          </p>
          <p>
            <strong>Payment:</strong> {confirmation.paymentStatus.replaceAll("_", " ")}
          </p>
          {catalog.business.phone || catalog.business.email ? (
            <p>
              <strong>Contact:</strong> {[catalog.business.phone, catalog.business.email].filter(Boolean).join(" | ")}
            </p>
          ) : null}
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <a className="btn btn-primary" href={googleCalendarUrl()} rel="noreferrer" target="_blank">
            <CalendarPlus className="h-4 w-4" /> Google Calendar
          </a>
          <button className="btn btn-secondary" onClick={downloadCalendarFile}>
            <CalendarDays className="h-4 w-4" /> Save calendar
          </button>
          <a className="btn btn-secondary" href={emailDetailsUrl()}>
            <Mail className="h-4 w-4" /> Email details
          </a>
          <button className="btn btn-secondary" onClick={() => window.print()}>
            <Printer className="h-4 w-4" /> Print
          </button>
          <button className="btn btn-secondary" onClick={copyConfirmation}>
            <Copy className="h-4 w-4" /> Copy
          </button>
          <button className="btn btn-secondary" onClick={downloadConfirmation}>
            <Download className="h-4 w-4" /> Save text
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className={`w-full min-w-0 overflow-hidden ${embed ? "bg-white p-4" : "card p-5 sm:p-7"}`}>
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-5 border-b border-ink/10 pb-6">
        <div className="flex min-w-0 flex-wrap items-center gap-5">
          {catalog.business.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              alt={`${catalog.business.name} logo`}
              className="h-24 w-24 rounded-xl border border-slate-300 bg-white object-contain p-2 shadow-sm sm:h-32 sm:w-32"
              src={catalog.business.logo_url}
            />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-purple-600 text-3xl font-black text-white sm:h-24 sm:w-24">
              {catalog.business.name.slice(0, 1)}
            </div>
          )}
          <div className="min-w-0">
            <h1 className="break-words text-xl font-black text-ink">{catalog.business.name}</h1>
            {catalog.business.description ? <p className="mt-1 break-words text-xs font-bold uppercase tracking-[0.16em] text-slate-700">{catalog.business.description}</p> : null}
          </div>
        </div>
        {categoryId || selectedService ? (
          <button className="rounded-lg border border-slate-400 bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-slate-900 hover:border-purple-700 hover:bg-purple-50" onClick={() => setCategoryId("")} type="button">
            Start over
          </button>
        ) : null}
      </div>

      {error ? <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-700">{error}</p> : null}

      <form className="mt-6 grid min-w-0 gap-10" onSubmit={submit}>
        <div className="rounded-xl border border-purple-100 bg-purple-50/70 p-4">
          {clientSession ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-black text-ink">Signed in as {clientSession.full_name || clientSession.email}</p>
                <p className="mt-1 text-sm font-bold text-slate-700">
                  This appointment will be saved to your BookNest client history and checked against your other booking times.
                </p>
              </div>
              <Link className="rounded-lg border border-purple-700 bg-white px-4 py-2 text-sm font-black text-purple-800" href="/client/bookings">
                My bookings
              </Link>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-black text-ink">Want to track all your BookNest bookings?</p>
                <p className="mt-1 text-sm font-bold text-slate-700">
                  Login before booking to save this appointment and stop yourself from booking another appointment at the same time.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link className="rounded-lg border border-purple-700 bg-white px-4 py-2 text-sm font-black text-purple-800" href={clientLoginHref}>
                  Client login
                </Link>
                <Link className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-black text-white" href={clientSignupHref}>
                  Create client account
                </Link>
              </div>
            </div>
          )}
        </div>

        <div className="booking-step min-w-0">
          <h2 className="mb-5 text-xs font-black uppercase tracking-[0.18em] text-purple-600">1. Choose category</h2>
          {categoriesForBooking.length ? (
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {categoriesForBooking.map((category) => (
                <button
                  className={`booking-choice rounded-xl border p-4 text-left shadow-sm transition ${
                    categoryId === category.id ? "border-purple-700 bg-purple-100 ring-2 ring-purple-700/20" : "bg-white hover:bg-purple-50"
                  }`}
                  key={category.id}
                  onClick={() => setCategoryId(category.id)}
                  type="button"
                >
                  <span className="block font-black text-ink">{category.name}</span>
                  {category.description ? <span className="mt-1 block text-sm font-semibold leading-6 text-slate-700">{category.description}</span> : null}
                </button>
              ))}
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {fallbackServices.map((service) => (
                <button
                  className="booking-choice rounded-xl border bg-white p-4 text-left shadow-sm transition hover:bg-purple-50"
                  key={service.id}
                  onClick={() => setServiceId(service.id)}
                  type="button"
                >
                  <span className="block font-black text-ink">{service.name}</span>
                  {service.description ? <span className="mt-1 block text-sm font-semibold leading-6 text-slate-700">{service.description}</span> : null}
                  <span className="mt-3 block text-xs font-black uppercase tracking-[0.16em] text-slate-700">
                    {priceLabel(service.price_type, service.base_price, businessCurrency)} | {durationLabel(service.duration_minutes ?? 60)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {categoryId && !selectedService ? (
          <div className="booking-step booking-step-service">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xs font-black uppercase tracking-[0.18em] text-purple-600">2. Choose service</h2>
                {selectedCategory ? <p className="mt-2 text-sm font-bold text-slate-700">{selectedCategory.name}</p> : null}
              </div>
              <button className="rounded-lg border border-slate-400 bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-slate-900 hover:border-purple-700 hover:bg-purple-50" onClick={() => setCategoryId("")} type="button">
                Change category
              </button>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {categoryServices.map((service) => (
                <button
                  className="booking-choice rounded-xl border bg-white p-4 text-left shadow-sm transition hover:bg-purple-50"
                  key={service.id}
                  onClick={() => setServiceId(service.id)}
                  type="button"
                >
                  <span className="block font-black text-ink">{service.name}</span>
                  {service.description ? <span className="mt-1 block text-sm font-semibold leading-6 text-slate-700">{service.description}</span> : null}
                  <span className="mt-3 block text-xs font-black uppercase tracking-[0.16em] text-slate-700">
                    {priceLabel(service.price_type, service.base_price, businessCurrency)} | {durationLabel(service.duration_minutes ?? 60)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {selectedService ? (
          <div className="booking-step booking-step-option">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xs font-black uppercase tracking-[0.18em] text-purple-600">2. Service selected</h2>
                <p className="mt-2 text-lg font-black text-ink">{selectedService.name}</p>
                {selectedService.description ? <p className="mt-1 max-w-3xl text-sm font-semibold leading-6 text-slate-700">{selectedService.description}</p> : null}
              </div>
              <button className="rounded-lg border border-slate-400 bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-slate-900 hover:border-purple-700 hover:bg-purple-50" onClick={() => setServiceId("")} type="button">
                Change service
              </button>
            </div>
            {serviceOptions.length ? <h3 className="mb-4 text-xs font-black uppercase tracking-[0.18em] text-purple-600">3. Choose option</h3> : null}
            <div className="grid gap-x-16 gap-y-5 md:grid-cols-2">
              {serviceOptions.map((option) => (
                <label className={`booking-choice flex cursor-pointer items-start gap-4 rounded-lg border bg-white p-4 text-sm shadow-sm transition hover:bg-purple-50 ${optionId === option.id ? "border-purple-700 bg-purple-100 ring-2 ring-purple-700/20" : ""}`} key={option.id}>
                  <input className="mt-1 h-5 w-5 accent-purple-700" checked={optionId === option.id} onChange={() => setOptionId(option.id)} type="radio" />
                  <span>
                    <span className="block font-bold text-ink">{option.name}</span>
                    <span className="block font-semibold text-slate-700">
                      {option.duration_minutes ? `${durationLabel(option.duration_minutes)} ` : ""}
                      @ {inlinePriceLabel(option.price_type, option.price, businessCurrency)}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </div>
        ) : null}

        {readyForDetails ? (
          <div className="booking-step booking-step-addons">
            <h2 className="mb-5 text-xs font-black uppercase tracking-[0.18em] text-purple-600">{serviceOptions.length ? "4" : "3"}. Choose add-ons</h2>
            <div className="grid gap-x-16 gap-y-5 md:grid-cols-2">
              {serviceAddons.map((addon) => (
                <label className={`booking-choice flex cursor-pointer items-start gap-4 rounded-lg border bg-white p-4 text-sm shadow-sm transition hover:bg-purple-50 ${addonIds.includes(addon.id) ? "border-purple-700 bg-purple-100 ring-2 ring-purple-700/20" : ""}`} key={addon.id}>
                  <input
                    className="mt-1 h-5 w-5 accent-purple-700"
                    checked={addonIds.includes(addon.id)}
                    onChange={(event) => setAddonIds((current) => (event.target.checked ? [...current, addon.id] : current.filter((id) => id !== addon.id)))}
                    type="checkbox"
                  />
                  <span>
                    <span className="block font-bold text-ink">{addon.name}</span>
                    <span className="block font-semibold text-slate-700">
                      {addon.duration_minutes ? `+ ${durationLabel(addon.duration_minutes)} ` : ""}
                      @ {inlinePriceLabel(addon.price_type, addon.price, businessCurrency)}
                    </span>
                  </span>
                </label>
              ))}
              {!serviceAddons.length ? <p className="text-sm font-bold text-slate-700">No add-ons are attached to this service.</p> : null}
            </div>
          </div>
        ) : null}

        {readyForDetails ? (
          <div className="grid min-w-0 gap-8 xl:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
            <div className="min-w-0 rounded-xl border border-slate-300 bg-white p-3 shadow-sm sm:p-4">
              <div className="mb-4 flex items-center justify-between gap-2">
                <button className="rounded-lg border border-slate-400 bg-white p-2 text-slate-900 hover:border-purple-700 hover:text-purple-700" onClick={() => changeCalendarMonth(-1)} type="button">
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <p className="min-w-0 truncate text-sm font-black text-ink">{monthLabel(calendarMonth)}</p>
                <button className="rounded-lg border border-slate-400 bg-white p-2 text-slate-900 hover:border-purple-700 hover:text-purple-700" onClick={() => changeCalendarMonth(1)} type="button">
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>
              <div className="grid min-w-0 grid-cols-7 gap-1 text-center text-sm sm:gap-y-3">
                {["S", "M", "T", "W", "T", "F", "S"].map((day) => (
                  <span className="py-1 text-xs font-black text-ink sm:text-sm" key={day}>
                    {day}
                  </span>
                ))}
                {calendarDays.map((day, index) => {
                  const value = day ? isoDate(day) : "";
                  const disabled = !day || value < today || value > maxBookableDate;
                  return (
                    <button
                      className={`mx-auto grid aspect-square w-full max-w-9 place-items-center rounded-full text-xs sm:text-sm ${
                        !day
                          ? "invisible"
                          : date === value
                            ? "bg-purple-700 text-white shadow-md"
                            : disabled
                              ? "cursor-not-allowed text-slate-400"
                              : "text-slate-950 ring-1 ring-transparent hover:bg-purple-50 hover:ring-purple-700"
                      }`}
                      disabled={disabled}
                      key={`${value || "blank"}-${index}`}
                      onClick={() => {
                        setDate(value);
                        setStartTime("");
                      }}
                      title={disabled && day ? "Past dates cannot be booked" : undefined}
                      type="button"
                    >
                      {day?.getDate()}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="min-w-0 rounded-xl border border-slate-300 bg-white p-3 shadow-sm sm:p-4">
              <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-black text-ink">{date ? dateLabel(date) : "Select a date"}</p>
                  <p className="mt-2 text-xs font-black uppercase tracking-[0.12em] text-slate-700 sm:tracking-[0.16em]">
                    Time Zone: <span className="underline">{catalog.business.timezone || "Local time"}</span>
                  </p>
                  <p className="mt-2 text-xs font-bold text-slate-700">
                    {catalog.business.booking_notice_hours ? `${catalog.business.booking_notice_hours} hour notice required. ` : ""}
                    Book up to {catalog.business.max_advance_booking_days ?? 90} days ahead.
                  </p>
                </div>
                <div className="flex gap-2 xl:hidden">
                  <button className="rounded-lg border border-slate-400 bg-white p-2 text-slate-900 hover:border-purple-700 hover:text-purple-700" onClick={() => changeCalendarMonth(-1)} type="button">
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button className="rounded-lg border border-slate-400 bg-white p-2 text-slate-900 hover:border-purple-700 hover:text-purple-700" onClick={() => changeCalendarMonth(1)} type="button">
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </div>
              </div>
              <div className="grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-3">
                {slots.map((slot) => (
                  <button
                    className={`min-w-0 rounded-lg border px-3 py-4 text-sm font-black sm:px-5 sm:py-5 ${
                      startTime === slot ? "border-purple-700 bg-purple-700 text-white shadow-md" : "border-slate-400 bg-white text-slate-950 hover:border-purple-700 hover:bg-purple-50"
                    }`}
                    key={slot}
                    onClick={() => setStartTime(slot)}
                    type="button"
                  >
                    {timeLabel(slot)}
                  </button>
                ))}
                {date && slots.length === 0 ? <p className="col-span-full text-sm font-bold text-slate-700">No slots available for this date.</p> : null}
                {!date ? <p className="col-span-full text-sm font-bold text-slate-700">Choose a date to see available times.</p> : null}
              </div>
            </div>
          </div>
        ) : null}

        {readyForDetails ? (
          <div className="grid gap-4 border-t border-ink/10 pt-8 md:grid-cols-3">
            <label>
              <span className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-slate-700">Full name</span>
              <input className="w-full rounded-lg border border-slate-400 bg-white px-4 py-3 text-ink outline-none focus:border-purple-700" value={clientName} onChange={(event) => setClientName(event.target.value)} minLength={2} required />
            </label>
            <label>
              <span className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-slate-700">Email</span>
              <input className="w-full rounded-lg border border-slate-400 bg-white px-4 py-3 text-ink outline-none focus:border-purple-700" type="email" value={clientEmail} onChange={(event) => setClientEmail(event.target.value)} />
            </label>
            <label>
              <span className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-slate-700">Phone</span>
              <input className="w-full rounded-lg border border-slate-400 bg-white px-4 py-3 text-ink outline-none focus:border-purple-700" value={clientPhone} onChange={(event) => setClientPhone(event.target.value)} minLength={5} required />
            </label>
            <label className="md:col-span-3">
              <span className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-slate-700">Notes/message</span>
              <textarea className="min-h-24 w-full rounded-lg border border-slate-400 bg-white px-4 py-3 text-ink outline-none focus:border-purple-700" value={notes} onChange={(event) => setNotes(event.target.value)} />
            </label>
            {questions.map((question) => (
              <label className="md:col-span-3" key={question.id}>
                <span className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-slate-700">{question.question}</span>
                <input
                  className="w-full rounded-lg border border-slate-400 bg-white px-4 py-3 text-ink outline-none focus:border-purple-700"
                  onChange={(event) => setFormAnswers((current) => ({ ...current, [question.id]: event.target.value }))}
                  required={question.is_required}
                  value={formAnswers[question.id] || ""}
                />
              </label>
            ))}
          </div>
        ) : null}

        {readyForDetails ? (
          <div className="rounded-xl border border-slate-300 bg-white p-4">
            <h2 className="font-black text-ink">Coupon</h2>
            <div className="mt-3 flex flex-col gap-3 sm:flex-row">
              <input
                className="w-full rounded-lg border border-slate-400 bg-white px-4 py-3 text-ink outline-none focus:border-purple-700"
                onChange={(event) => {
                  setCouponCode(event.target.value);
                  if (appliedCouponCode) clearCoupon();
                }}
                placeholder="Enter coupon code"
                value={couponCode}
              />
              <button className="rounded-lg border border-slate-400 bg-white px-5 py-3 font-black text-slate-950 hover:border-purple-700 hover:bg-purple-50 disabled:opacity-50" disabled={couponBusy || discountedServiceTotal == null} onClick={applyCoupon} type="button">
                {couponBusy ? "Checking..." : "Apply"}
              </button>
            </div>
            {couponMessage ? (
              <p className={`mt-3 text-sm font-bold ${couponDiscount > 0 ? "text-emerald-600" : "text-rose-600"}`}>
                {couponMessage}
                {!clientSession && couponMessage.toLowerCase().includes("login") ? (
                  <>
                    {" "}
                    <Link className="underline" href="/client/login">
                      Login here
                    </Link>
                    .
                  </>
                ) : null}
              </p>
            ) : null}
            {couponDiscount > 0 ? (
              <div className="mt-3 grid gap-1 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-800">
                <span>Coupon starts from: {currencyFor(discountedServiceTotal, businessCurrency)}</span>
                <span>Discount: -{currencyFor(couponDiscount, businessCurrency)}</span>
                <span>New total: {currencyFor(finalTotalPrice, businessCurrency)}</span>
              </div>
            ) : null}
          </div>
        ) : null}

        {readyForDetails ? (
          <div className="rounded-xl border border-slate-300 bg-white p-4">
            <h2 className="font-black text-ink">Payment</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className={`flex items-start gap-3 rounded-lg border border-slate-400 p-3 font-bold text-ink ${onlinePaymentAvailable && finalTotalPrice != null && finalTotalPrice > 0 ? "cursor-pointer hover:border-purple-700 hover:bg-purple-50" : "cursor-not-allowed opacity-60"}`}>
                <input
                  checked={paymentMode === "online"}
                  className="mt-1 accent-purple-600"
                  disabled={!onlinePaymentAvailable || finalTotalPrice == null || finalTotalPrice <= 0}
                  onChange={() => setPaymentMode("online")}
                  type="radio"
                />
                <span>
                  Pay online
                  <span className="block text-sm font-semibold text-slate-700">
                    {onlinePaymentAvailable
                      ? "Card checkout. Payment confirms automatically after Stripe approves it."
                      : "Coming soon. Manual payment is available now."}
                  </span>
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-400 p-3 font-bold text-ink hover:border-purple-700 hover:bg-purple-50">
                <input
                  checked={paymentMode === "manual"}
                  className="mt-1 accent-purple-600"
                  onChange={() => setPaymentMode("manual")}
                  type="radio"
                />
                <span>
                  Manual payment
                  <span className="block text-sm font-semibold text-slate-700">
                    Bank transfer or app payment, then owner confirms manually.
                  </span>
                </span>
              </label>
            </div>
            {finalTotalPrice == null ? <p className="mt-3 text-sm font-bold text-slate-700">Online payment needs a fixed price. This service can still use manual payment.</p> : null}
            {finalTotalPrice === 0 ? <p className="mt-3 text-sm font-bold text-slate-700">This booking total is zero after discount, so manual confirmation will be used.</p> : null}
            {!onlinePaymentAvailable ? <p className="mt-3 text-sm font-bold text-slate-700">{onlinePaymentReason}</p> : null}
          </div>
        ) : null}

        {readyForDetails && selectedService?.deposit_required && paymentMode === "manual" ? (
          <div className="rounded-xl border border-purple-200 bg-purple-50 p-4">
            <h2 className="font-black text-ink">Deposit required</h2>
            <p className="mt-1 text-sm font-semibold leading-6 text-slate-700">Send {currencyFor(selectedService.deposit_amount, businessCurrency)} by bank transfer, then upload your receipt.</p>
            <div className="mt-3 grid gap-2 text-sm text-slate-800">
              <p><strong>Bank:</strong> {catalog.business.bank_name || "Contact business for bank details"}</p>
              <p><strong>Account name:</strong> {catalog.business.bank_account_name || "Not provided"}</p>
              <p><strong>Account number:</strong> {catalog.business.bank_account_number || "Not provided"}</p>
            </div>
            <label className="mt-4 block">
              <span className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-slate-700">Upload receipt image</span>
              <span className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-400 bg-white px-4 py-3 font-black text-ink">
                <Upload className="h-4 w-4" /> {receipt ? receipt.name : "Choose receipt"}
              </span>
              <input className="sr-only" accept="image/png,image/jpeg,image/webp" onChange={updateReceipt} type="file" />
            </label>
          </div>
        ) : null}

        {readyForDetails ? (
          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-ink/10 pt-6">
            <div className="text-sm text-slate-800">
              <p className="font-black text-ink">Total: {currencyFor(finalTotalPrice, businessCurrency)}</p>
              {serviceDiscountAmount > 0 && totalPrice != null ? (
                <p className="mt-1 font-bold text-emerald-600">
                  {serviceDiscountMessage || serviceDiscount?.name}: -{currencyFor(serviceDiscountAmount, businessCurrency)} from {currencyFor(totalPrice, businessCurrency)}
                </p>
              ) : serviceDiscountBusy ? (
                <p className="mt-1 font-bold text-slate-700">Checking service discount...</p>
              ) : null}
              {couponDiscount > 0 && totalPrice != null ? (
                <p className="mt-1 font-bold text-emerald-600">
                  Coupon {appliedCouponCode}: -{currencyFor(couponDiscount, businessCurrency)} from {currencyFor(discountedServiceTotal, businessCurrency)}
                </p>
              ) : null}
              <p className="mt-1 flex items-center gap-2"><CalendarDays className="h-4 w-4" /> Estimated duration: {durationLabel(duration)}</p>
              {optionRequired && !selectedOption ? <p className="mt-2 font-bold text-purple-600">Choose a service option to continue.</p> : null}
            </div>
            <button className="rounded-lg bg-purple-600 px-6 py-4 text-sm font-black uppercase tracking-[0.14em] text-white shadow-lg shadow-purple-500/20 disabled:opacity-40" disabled={!canBook}>
              {busy ? "Booking..." : "Book appointment"}
            </button>
          </div>
        ) : null}
      </form>
    </section>
  );
}
