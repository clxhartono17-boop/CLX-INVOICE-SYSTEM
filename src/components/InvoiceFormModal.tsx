import React, { useEffect, useMemo, useState } from 'react';
import type {
  AppSettings,
  CustomerRecord,
  InvoiceLineItem,
  InvoiceMode,
  InvoiceRecord,
  PaymentStatus,
  QueryRow,
  TerminPercent,
} from '../types/invoice';
import {
  DEFAULT_VGREEN_CUSTOMER,
  calculateInvoiceAmounts,
  extractSequenceNumber,
  formatDateDdMmmYyyy,
  formatPeriodDisplay,
  formatRupiah,
  formatRupiahWithPrefix,
  generateNextInvoiceNumber,
  getTerminAvailability,
  getTerminLabel,
  isVgreenCustomer,
  makeProjectKey,
  normalizeText,
  validateInvoiceForm,
} from '../utils/invoiceLogic';
import { ConfirmDialog } from './ConfirmDialog';
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  Lock,
  Plus,
  Search,
  Trash2,
  UserPlus,
  X,
} from 'lucide-react';

interface InvoiceFormModalProps {
  open: boolean;
  initialMode: InvoiceMode;
  editingInvoice: InvoiceRecord | null;
  preselectedRow: QueryRow | null;
  preselectedTermin?: TerminPercent;
  queryRows: QueryRow[];
  existingInvoices: InvoiceRecord[];
  customers: CustomerRecord[];
  settings: AppSettings;
  isSaving: boolean;
  onClose: () => void;
  onAddCustomer: (payload: { name: string; address: string }) => Promise<CustomerRecord>;
  onSave: (invoice: InvoiceRecord, isEdit: boolean) => Promise<void>;
}

export const InvoiceFormModal: React.FC<InvoiceFormModalProps> = ({
  open,
  initialMode,
  editingInvoice,
  preselectedRow,
  preselectedTermin,
  queryRows,
  existingInvoices,
  customers,
  settings,
  isSaving,
  onClose,
  onAddCustomer,
  onSave,
}) => {
  const isEdit = Boolean(editingInvoice);
  const todayIso = new Date().toISOString().slice(0, 10);

  const [mode, setMode] = useState<InvoiceMode>(initialMode);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(DEFAULT_VGREEN_CUSTOMER.id);
  const [customerSearch, setCustomerSearch] = useState<string>('');
  const [addingCustomer, setAddingCustomer] = useState<boolean>(false);
  const [newCustomerName, setNewCustomerName] = useState<string>('');
  const [newCustomerAddress, setNewCustomerAddress] = useState<string>('');
  const [newCustomerError, setNewCustomerError] = useState<string | null>(null);
  const [isAddingCustomer, setIsAddingCustomer] = useState<boolean>(false);

  const [selectedProjectKey, setSelectedProjectKey] = useState<string>('');
  const [manualProjectType, setManualProjectType] = useState<string>('');
  const [manualWoPoNumber, setManualWoPoNumber] = useState<string>('');

  const [invoiceDate, setInvoiceDate] = useState<string>(todayIso);
  const [period, setPeriod] = useState<string>(formatPeriodDisplay(todayIso));
  const [manualInvoiceNumber, setManualInvoiceNumber] = useState<string>('');
  const [termin, setTermin] = useState<TerminPercent>(35);
  const [taxRate, setTaxRate] = useState<number>(settings.defaultTaxRate);
  const [noEfaktur, setNoEfaktur] = useState<string>('');
  const [billToName, setBillToName] = useState<string>(settings.defaultBillToName);
  const [billToAddress, setBillToAddress] = useState<string>(settings.defaultBillToAddress);
  const [items, setItems] = useState<InvoiceLineItem[]>([]);
  const [legacyPaymentStatus, setLegacyPaymentStatus] = useState<PaymentStatus>('UNPAID');
  const [legacyPaidDate, setLegacyPaidDate] = useState<string>('');
  const [legacyPaymentRef, setLegacyPaymentRef] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [pendingConfirmInvoice, setPendingConfirmInvoice] = useState<InvoiceRecord | null>(null);

  const vgreenCustomer = useMemo(
    () => customers.find((c) => c.isVgreen || isVgreenCustomer(c.name)) || DEFAULT_VGREEN_CUSTOMER,
    [customers]
  );

  const selectedCustomer = useMemo(() => {
    return (
      customers.find((c) => c.id === selectedCustomerId) ||
      customers.find(
        (c) => normalizeText(c.name).toLowerCase() === normalizeText(billToName).toLowerCase()
      ) ||
      vgreenCustomer
    );
  }, [customers, selectedCustomerId, billToName, vgreenCustomer]);

  const selectedIsVgreen = useMemo(
    () => isVgreenCustomer(billToName || selectedCustomer.name),
    [billToName, selectedCustomer]
  );

  const filteredCustomers = useMemo(() => {
    const q = customerSearch.trim().toLowerCase();
    if (!q) return customers;
    const matches = customers.filter(
      (c) => c.name.toLowerCase().includes(q) || c.address.toLowerCase().includes(q)
    );
    // Keep currently selected customer in options so <select> stays consistent
    if (selectedCustomer && !matches.some((c) => c.id === selectedCustomer.id)) {
      return [selectedCustomer, ...matches];
    }
    return matches;
  }, [customers, customerSearch, selectedCustomer]);

  // Initialize form whenever modal opens
  useEffect(() => {
    if (!open) return;
    setErrorMsg(null);
    setPendingConfirmInvoice(null);
    setAddingCustomer(false);
    setNewCustomerName('');
    setNewCustomerAddress('');
    setNewCustomerError(null);
    setCustomerSearch('');

    if (editingInvoice) {
      const editIsVgreen = isVgreenCustomer(editingInvoice.billToName);
      const matchedCust =
        customers.find(
          (c) =>
            normalizeText(c.name).toLowerCase() ===
            normalizeText(editingInvoice.billToName).toLowerCase()
        ) || (editIsVgreen ? vgreenCustomer : customers[0]);

      setMode(editingInvoice.mode);
      setSelectedCustomerId(matchedCust?.id || DEFAULT_VGREEN_CUSTOMER.id);
      setSelectedProjectKey(
        makeProjectKey(editingInvoice.chargingType, editingInvoice.projectLocation)
      );
      setManualProjectType(editIsVgreen ? '' : editingInvoice.chargingType);
      setManualWoPoNumber(editIsVgreen ? '' : editingInvoice.consWoNumber);
      setInvoiceDate(editingInvoice.invoiceDate || todayIso);
      setPeriod(formatPeriodDisplay(editingInvoice.period, editingInvoice.invoiceDate || todayIso));
      setManualInvoiceNumber(editingInvoice.invoiceNumber);
      setTermin(editingInvoice.termin);
      setTaxRate(editingInvoice.taxRate);
      setNoEfaktur(editingInvoice.noEfaktur);
      setBillToName(editingInvoice.billToName);
      setBillToAddress(editingInvoice.billToAddress);
      setItems(
        editingInvoice.items.length > 0
          ? editingInvoice.items
          : [
              {
                id: 'item-1',
                description: editingInvoice.projectLocation,
                qty: 1,
                uom: 'Unit',
                unitPrice: editingInvoice.contractAmount,
                amount: editingInvoice.contractAmount,
              },
            ]
      );
      setLegacyPaymentStatus(editingInvoice.paymentStatus);
      setLegacyPaidDate(editingInvoice.paidDate);
      setLegacyPaymentRef(editingInvoice.paymentRef);
      return;
    }

    setMode(initialMode);
    setSelectedCustomerId(vgreenCustomer.id);
    setBillToName(vgreenCustomer.name);
    setBillToAddress(vgreenCustomer.address);
    setManualProjectType('');
    setManualWoPoNumber('');

    const defaultRow = preselectedRow || queryRows[0] || null;
    const key = defaultRow
      ? makeProjectKey(defaultRow.chargingType, defaultRow.projectLocation)
      : '';
    setSelectedProjectKey(key);
    setInvoiceDate(todayIso);
    setPeriod(formatPeriodDisplay(todayIso));
    setManualInvoiceNumber('');
    setTaxRate(settings.defaultTaxRate);
    setNoEfaktur('');
    setLegacyPaymentStatus(initialMode === 'LEGACY' ? 'PAID' : 'UNPAID');
    setLegacyPaidDate(initialMode === 'LEGACY' ? todayIso : '');
    setLegacyPaymentRef('');

    if (defaultRow) {
      const vgreenInvoices = existingInvoices.filter(
        (i) => !i.billToName || isVgreenCustomer(i.billToName)
      );
      const avail = getTerminAvailability(
        defaultRow.chargingType,
        defaultRow.projectLocation,
        vgreenInvoices,
        initialMode
      );
      const chosenTermin =
        preselectedTermin && avail.allowedTermins.includes(preselectedTermin)
          ? preselectedTermin
          : avail.recommendedTermin || 35;
      setTermin(chosenTermin);

      const priorInv = vgreenInvoices.find(
        (i) => makeProjectKey(i.chargingType, i.projectLocation) === key
      );
      const defaultUnitPrice = priorInv ? priorInv.contractAmount : 8500000;
      setItems(
        priorInv && priorInv.items.length > 0
          ? priorInv.items.map((it) => ({ ...it }))
          : [
              {
                id: 'item-1',
                description: defaultRow.projectLocation,
                qty: 1,
                uom: 'Unit',
                unitPrice: defaultUnitPrice,
                amount: defaultUnitPrice,
              },
            ]
      );
    } else {
      setItems([
        {
          id: 'item-1',
          description: '',
          qty: 1,
          uom: 'Unit',
          unitPrice: 0,
          amount: 0,
        },
      ]);
    }
  }, [open, editingInvoice, initialMode, preselectedRow, preselectedTermin]);

  const selectedQueryRow = useMemo(() => {
    if (!selectedIsVgreen) return null;
    if (editingInvoice) {
      return (
        queryRows.find(
          (r) => makeProjectKey(r.chargingType, r.projectLocation) === selectedProjectKey
        ) || {
          rowIndex: 0,
          epcName: editingInvoice.epcName,
          chargingType: editingInvoice.chargingType,
          projectLocation: editingInvoice.projectLocation,
          consWoNumber: editingInvoice.consWoNumber,
          colYDateRaw: editingInvoice.queryDateIso || '',
          colYDateIso: editingInvoice.queryDateIso,
          retentionDueIso: editingInvoice.retentionDueIso,
        }
      );
    }
    return (
      queryRows.find(
        (r) => makeProjectKey(r.chargingType, r.projectLocation) === selectedProjectKey
      ) || null
    );
  }, [queryRows, selectedProjectKey, editingInvoice, selectedIsVgreen]);

  const availability = useMemo(() => {
    if (!selectedIsVgreen) {
      return {
        hasTermin35: false,
        hasTermin60: false,
        hasTermin5: false,
        allowedTermins: [35, 60, 5] as TerminPercent[],
        recommendedTermin: 35 as TerminPercent | null,
        lockedReasons: { 35: null, 60: null, 5: null } as Record<TerminPercent, string | null>,
      };
    }

    if (!selectedQueryRow) {
      return {
        hasTermin35: false,
        hasTermin60: false,
        hasTermin5: false,
        allowedTermins: [] as TerminPercent[],
        recommendedTermin: null as TerminPercent | null,
        lockedReasons: { 35: null, 60: null, 5: null } as Record<TerminPercent, string | null>,
      };
    }

    const vgreenInvoices = existingInvoices.filter(
      (i) => !i.billToName || isVgreenCustomer(i.billToName)
    );
    return getTerminAvailability(
      selectedQueryRow.chargingType,
      selectedQueryRow.projectLocation,
      vgreenInvoices,
      mode,
      editingInvoice?.id
    );
  }, [selectedIsVgreen, selectedQueryRow, existingInvoices, mode, editingInvoice]);

  // Keep termin valid when project, customer, or mode changes
  useEffect(() => {
    if (!open || isEdit) return;
    if (
      availability.allowedTermins.length > 0 &&
      !availability.allowedTermins.includes(termin)
    ) {
      setTermin(availability.allowedTermins[0]);
    }
  }, [availability, termin, open, isEdit]);

  // Global continuous invoice counter across ALL customers (Requirement 7)
  const autoGeneratedNumber = useMemo(() => {
    return generateNextInvoiceNumber(
      existingInvoices,
      settings.startingSequence,
      invoiceDate || todayIso
    );
  }, [existingInvoices, settings.startingSequence, invoiceDate, todayIso]);

  const activeInvoiceNumber =
    mode === 'NEW' && !isEdit ? autoGeneratedNumber.invoiceNumber : manualInvoiceNumber;

  const amounts = useMemo(
    () => calculateInvoiceAmounts(items, termin, taxRate),
    [items, termin, taxRate]
  );

  if (!open) return null;

  const applyCustomerSelection = (customer: CustomerRecord) => {
    const nextIsVgreen = isVgreenCustomer(customer.name);
    setSelectedCustomerId(customer.id);
    setBillToName(customer.name);
    setBillToAddress(customer.address);
    setErrorMsg(null);

    if (nextIsVgreen) {
      // Restore Vgreen Sheet Query row & auto item description
      const row =
        queryRows.find(
          (r) => makeProjectKey(r.chargingType, r.projectLocation) === selectedProjectKey
        ) ||
        queryRows[0] ||
        null;
      if (row) {
        const key = makeProjectKey(row.chargingType, row.projectLocation);
        setSelectedProjectKey(key);
        const priorInv = existingInvoices.find(
          (i) =>
            (!i.billToName || isVgreenCustomer(i.billToName)) &&
            makeProjectKey(i.chargingType, i.projectLocation) === key
        );
        if (priorInv && priorInv.items.length > 0) {
          setItems(priorInv.items.map((it) => ({ ...it })));
        } else {
          setItems([
            {
              id: 'item-1',
              description: row.projectLocation,
              qty: 1,
              uom: 'Unit',
              unitPrice: 8500000,
              amount: 8500000,
            },
          ]);
        }
      }
    } else if (!isEdit) {
      // Requirement 6: Non-Vgreen customers use manual ITEM DESCRIPTION input
      setItems([
        {
          id: `item-${Date.now()}`,
          description: '',
          qty: 1,
          uom: 'Unit',
          unitPrice: 0,
          amount: 0,
        },
      ]);
      setTermin(35);
    }
  };

  const handleCustomerSelectChange = (custId: string) => {
    const found = customers.find((c) => c.id === custId);
    if (found) {
      applyCustomerSelection(found);
    }
  };

  const handleCreateCustomer = async () => {
    const cleanName = normalizeText(newCustomerName);
    const cleanAddr = newCustomerAddress.trim();
    setNewCustomerError(null);

    if (!cleanName) {
      setNewCustomerError('Nama customer wajib diisi.');
      return;
    }
    if (!cleanAddr) {
      setNewCustomerError('Alamat lengkap customer wajib diisi.');
      return;
    }

    const existing = customers.find(
      (c) => normalizeText(c.name).toLowerCase() === cleanName.toLowerCase()
    );
    if (existing) {
      setNewCustomerError(`Customer "${existing.name}" sudah terdaftar.`);
      return;
    }

    setIsAddingCustomer(true);
    try {
      const created = await onAddCustomer({ name: cleanName, address: cleanAddr });
      applyCustomerSelection(created);
      setAddingCustomer(false);
      setNewCustomerName('');
      setNewCustomerAddress('');
      setCustomerSearch('');
    } catch (err: unknown) {
      setNewCustomerError(
        err instanceof Error ? err.message : 'Gagal menyimpan customer baru.'
      );
    } finally {
      setIsAddingCustomer(false);
    }
  };

  const handleProjectChange = (key: string) => {
    setSelectedProjectKey(key);
    setErrorMsg(null);
    const row = queryRows.find(
      (r) => makeProjectKey(r.chargingType, r.projectLocation) === key
    );
    if (!row) return;

    const priorInv = existingInvoices.find(
      (i) =>
        (!i.billToName || isVgreenCustomer(i.billToName)) &&
        makeProjectKey(i.chargingType, i.projectLocation) === key
    );
    if (priorInv && priorInv.items.length > 0) {
      setItems(priorInv.items.map((it) => ({ ...it })));
    } else {
      setItems([
        {
          id: 'item-1',
          description: row.projectLocation,
          qty: 1,
          uom: 'Unit',
          unitPrice: 8500000,
          amount: 8500000,
        },
      ]);
    }
  };

  const handleItemChange = (
    idx: number,
    field: keyof InvoiceLineItem,
    rawVal: string | number
  ) => {
    setItems((prev) =>
      prev.map((item, i) => {
        if (i !== idx) return item;
        const updated = { ...item, [field]: rawVal };
        const qty = Number(updated.qty) || 0;
        const unitPrice = Number(updated.unitPrice) || 0;
        updated.amount = Math.round(qty * unitPrice);
        return updated;
      })
    );
  };

  const handleAddItem = () => {
    setItems((prev) => [
      ...prev,
      {
        id: `item-${Date.now()}`,
        description: '',
        qty: 1,
        uom: 'Unit',
        unitPrice: 0,
        amount: 0,
      },
    ]);
  };

  const handleRemoveItem = (idx: number) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (selectedIsVgreen && !selectedQueryRow) {
      setErrorMsg('Pilih proyek CLX dari sheet Query terlebih dahulu.');
      return;
    }

    const effectiveChargingType = selectedIsVgreen
      ? selectedQueryRow?.chargingType || ''
      : manualProjectType.trim() || '-';
    const effectiveProjectLocation = selectedIsVgreen
      ? selectedQueryRow?.projectLocation || ''
      : items.find((it) => it.description.trim())?.description.trim() ||
        billToName.trim();
    const effectiveWoNumber = selectedIsVgreen
      ? selectedQueryRow?.consWoNumber || ''
      : manualWoPoNumber.trim() || '-';

    const validationError = validateInvoiceForm({
      mode,
      invoiceNumber: activeInvoiceNumber,
      chargingType: effectiveChargingType,
      projectLocation: effectiveProjectLocation,
      consWoNumber: effectiveWoNumber,
      termin,
      items,
      existingInvoices,
      editingInvoiceId: editingInvoice?.id,
      billToName: billToName.trim(),
      isVgreen: selectedIsVgreen,
    });

    if (validationError) {
      setErrorMsg(validationError);
      return;
    }

    const nowIso = new Date().toISOString();
    const seqNumber =
      mode === 'NEW' && !isEdit
        ? autoGeneratedNumber.seqNumber
        : extractSequenceNumber(activeInvoiceNumber);

    const payload: InvoiceRecord = {
      id: editingInvoice ? editingInvoice.id : `inv-${Date.now()}`,
      rowIndex: editingInvoice?.rowIndex,
      invoiceNumber: activeInvoiceNumber.trim(),
      seqNumber,
      mode,
      invoiceDate,
      invoiceDateDisplay: formatDateDdMmmYyyy(invoiceDate),
      period: formatPeriodDisplay(period.trim(), invoiceDate) || formatPeriodDisplay(invoiceDate),
      epcName: 'CLX',
      chargingType: effectiveChargingType,
      projectLocation: effectiveProjectLocation,
      consWoNumber: effectiveWoNumber,
      queryDateIso: selectedIsVgreen ? selectedQueryRow?.colYDateIso ?? null : null,
      termin,
      terminLabel: getTerminLabel(termin),
      contractAmount: amounts.contractAmount,
      terminAmount: amounts.terminAmount,
      taxRate,
      taxAmount: amounts.taxAmount,
      grandTotal: amounts.grandTotal,
      amountInWords: amounts.amountInWords,
      noEfaktur: noEfaktur.trim(),
      billToName: billToName.trim(),
      billToAddress: billToAddress.trim(),
      items: items.map((it) => ({
        ...it,
        qty: Number(it.qty) || 0,
        unitPrice: Number(it.unitPrice) || 0,
        amount: Math.round((Number(it.qty) || 0) * (Number(it.unitPrice) || 0)),
      })),
      paymentStatus: editingInvoice
        ? editingInvoice.paymentStatus
        : mode === 'LEGACY'
          ? legacyPaymentStatus
          : 'UNPAID',
      paidDate: editingInvoice
        ? editingInvoice.paidDate
        : mode === 'LEGACY' && legacyPaymentStatus === 'PAID'
          ? legacyPaidDate || invoiceDate
          : '',
      paymentRef: editingInvoice
        ? editingInvoice.paymentRef
        : mode === 'LEGACY' && legacyPaymentStatus === 'PAID'
          ? legacyPaymentRef
          : '',
      paymentNote: editingInvoice ? editingInvoice.paymentNote : '',
      retentionDueIso: selectedIsVgreen ? selectedQueryRow?.retentionDueIso ?? null : null,
      signatoryName: editingInvoice?.signatoryName || settings.signatoryName,
      signatoryTitle: editingInvoice?.signatoryTitle || settings.signatoryTitle,
      signatoryCity: editingInvoice?.signatoryCity || settings.signatoryCity,
      createdAt: editingInvoice ? editingInvoice.createdAt : nowIso,
      updatedAt: nowIso,
    };

    if (isEdit) {
      setPendingConfirmInvoice(payload);
      return;
    }

    await onSave(payload, false);
  };

  return (
    <>
      <div
        className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/50 backdrop-blur-[2px] p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="invoice-form-title"
      >
        <div className="flex max-h-[90vh] w-full max-w-4xl flex-col rounded-xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-6 py-4">
            <div>
              <h2 id="invoice-form-title" className="font-display text-lg font-bold text-slate-900">
                {isEdit
                  ? `Edit Invoice · ${editingInvoice?.invoiceNumber}`
                  : mode === 'LEGACY'
                    ? 'Input Invoice Lama (Migrasi ke Sistem)'
                    : 'Buat Invoice Baru (Auto-Numbering)'}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Data langsung tersimpan ke Google Sheet tab{' '}
                <span className="font-mono text-slate-700">{settings.invoicesSheetName}</span>
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Tutup form invoice"
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-1 flex-col min-h-0">
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
              {/* Mode Switcher (only when creating) */}
              {!isEdit && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="text-xs text-slate-600">Pilih mode pembuatan invoice:</div>
                  <div className="flex items-center gap-1 rounded-lg bg-slate-200/70 p-1">
                    <button
                      type="button"
                      onClick={() => setMode('NEW')}
                      className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                        mode === 'NEW'
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Invoice Baru (Auto Nomor)
                    </button>
                    <button
                      type="button"
                      onClick={() => setMode('LEGACY')}
                      className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                        mode === 'LEGACY'
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Input Invoice Lama (Legacy)
                    </button>
                  </div>
                </div>
              )}

              {/* Scalable Customer Selection & Minimal Add New Customer */}
              <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label
                    htmlFor="invoice-customer-select"
                    className="flex items-center gap-1.5 text-xs font-semibold text-slate-800"
                  >
                    <Building2 className="h-3.5 w-3.5 text-slate-500" />
                    <span>Customer (Bill To) · {customers.length} terdaftar</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setAddingCustomer((prev) => !prev);
                      setNewCustomerError(null);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-[#0A192F] hover:bg-slate-100 transition-colors whitespace-nowrap"
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                    <span>{addingCustomer ? 'Tutup Form Customer' : 'Add New Customer'}</span>
                  </button>
                </div>

                {/* Search box appears automatically when customer list scales up (> 5) */}
                {customers.length > 5 && !addingCustomer && (
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                    <input
                      type="search"
                      value={customerSearch}
                      onChange={(e) => setCustomerSearch(e.target.value)}
                      placeholder="Filter cepat nama atau alamat customer..."
                      aria-label="Filter daftar customer"
                      className="w-full rounded-lg border border-slate-200 bg-white pl-8 pr-3 py-1.5 text-xs text-slate-900 focus:border-[#0A192F] focus:outline-none"
                    />
                  </div>
                )}

                <select
                  id="invoice-customer-select"
                  value={selectedCustomer.id}
                  disabled={isEdit}
                  onChange={(e) => handleCustomerSelectChange(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-900 focus:border-[#0A192F] focus:outline-none disabled:bg-slate-100 disabled:text-slate-600"
                >
                  {filteredCustomers.map((cust) => (
                    <option key={cust.id} value={cust.id}>
                      {cust.name}
                      {cust.isVgreen || isVgreenCustomer(cust.name)
                        ? ' (Terhubung Sheet Query)'
                        : ' (Input Item Manual)'}
                    </option>
                  ))}
                </select>

                {/* Inline Add New Customer (Strictly Nama Customer + Alamat Lengkap only) */}
                {addingCustomer && (
                  <div className="mt-2 space-y-3 border-t border-slate-200 pt-3.5">
                    <div className="text-xs font-semibold text-[#0A192F]">
                      Tambah Customer Baru (Tersimpan Otomatis &amp; Scalable)
                    </div>
                    <div className="space-y-1.5">
                      <label
                        htmlFor="new-customer-name"
                        className="block text-xs font-medium text-slate-700"
                      >
                        Nama Customer
                      </label>
                      <input
                        id="new-customer-name"
                        type="text"
                        value={newCustomerName}
                        onChange={(e) => setNewCustomerName(e.target.value)}
                        placeholder="Contoh: PT Sinar Energi Mandiri"
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-[#0A192F] focus:outline-none"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label
                        htmlFor="new-customer-address"
                        className="block text-xs font-medium text-slate-700"
                      >
                        Alamat Lengkap
                      </label>
                      <textarea
                        id="new-customer-address"
                        rows={2}
                        value={newCustomerAddress}
                        onChange={(e) => setNewCustomerAddress(e.target.value)}
                        placeholder="Masukkan alamat lengkap perusahaan customer..."
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-[#0A192F] focus:outline-none"
                      />
                    </div>
                    {newCustomerError && (
                      <div className="text-xs font-medium text-red-600">{newCustomerError}</div>
                    )}
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setAddingCustomer(false);
                          setNewCustomerError(null);
                        }}
                        disabled={isAddingCustomer}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                      >
                        Batal
                      </button>
                      <button
                        type="button"
                        onClick={handleCreateCustomer}
                        disabled={isAddingCustomer}
                        className="rounded-lg bg-[#0A192F] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#142B4F] disabled:opacity-50 whitespace-nowrap"
                      >
                        {isAddingCustomer ? 'Menyimpan...' : 'Simpan Customer'}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Project Source: Vgreen uses Sheet Query; Non-Vgreen uses Manual Project/WO/PO */}
              {selectedIsVgreen ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2 space-y-1.5">
                    <label
                      htmlFor="invoice-project-select"
                      className="block text-xs font-semibold text-slate-700"
                    >
                      Proyek &amp; Lokasi (Sheet Query · EPC = CLX · Cons WO terisi)
                    </label>
                    <select
                      id="invoice-project-select"
                      value={selectedProjectKey}
                      disabled={isEdit}
                      onChange={(e) => handleProjectChange(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-slate-900 focus:outline-none disabled:bg-slate-100 disabled:text-slate-600"
                    >
                      {queryRows.length === 0 && (
                        <option value="">Tidak ada data CLX dengan WO terisi</option>
                      )}
                      {queryRows.map((row) => {
                        const key = makeProjectKey(row.chargingType, row.projectLocation);
                        return (
                          <option key={`${key}-${row.rowIndex}`} value={key}>
                            {row.projectLocation} — {row.chargingType} (WO: {row.consWoNumber})
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  {/* Readonly extracted metadata */}
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5">
                    <div className="text-[11px] font-medium text-slate-500">
                      Charging Type (Kolom C)
                    </div>
                    <div className="mt-0.5 text-sm font-semibold text-slate-900">
                      {selectedQueryRow?.chargingType || '-'}
                    </div>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5">
                    <div className="text-[11px] font-medium text-slate-500">
                      WO/PO No. (Kolom W)
                    </div>
                    <div className="mt-0.5 font-mono text-sm font-semibold text-slate-900">
                      {selectedQueryRow?.consWoNumber || '-'}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label
                      htmlFor="manual-project-type"
                      className="block text-xs font-semibold text-slate-700"
                    >
                      Project Type (Manual / Opsional)
                    </label>
                    <input
                      id="manual-project-type"
                      type="text"
                      value={manualProjectType}
                      onChange={(e) => setManualProjectType(e.target.value)}
                      placeholder="Contoh: Electrical Installation / Maintenance"
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-[#0A192F] focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label
                      htmlFor="manual-wo-po"
                      className="block text-xs font-semibold text-slate-700"
                    >
                      WO/PO No. (Manual / Opsional)
                    </label>
                    <input
                      id="manual-wo-po"
                      type="text"
                      value={manualWoPoNumber}
                      onChange={(e) => setManualWoPoNumber(e.target.value)}
                      placeholder="Contoh: PO/2026/XI/012"
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-xs text-slate-900 focus:border-[#0A192F] focus:outline-none"
                    />
                  </div>
                </div>
              )}

              {/* Termin Selector */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-slate-700">
                    {selectedIsVgreen
                      ? 'Pilih Termin Penagihan (Proteksi Anti Double-Billing)'
                      : 'Pilih Termin Penagihan'}
                  </label>
                  {selectedIsVgreen && selectedQueryRow?.retentionDueIso && (
                    <span className="text-[11px] text-slate-500 tabular-nums">
                      Retensi 5% Jatuh Tempo: {formatDateDdMmmYyyy(selectedQueryRow.retentionDueIso)}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {([35, 60, 5] as TerminPercent[]).map((t) => {
                    const isAllowed = isEdit
                      ? t === editingInvoice?.termin
                      : availability.allowedTermins.includes(t);
                    const isSelected = termin === t;
                    const alreadyBilled =
                      (t === 35 && availability.hasTermin35) ||
                      (t === 60 && availability.hasTermin60) ||
                      (t === 5 && availability.hasTermin5);
                    const reason = availability.lockedReasons[t];

                    return (
                      <button
                        key={t}
                        type="button"
                        disabled={!isAllowed}
                        onClick={() => setTermin(t)}
                        className={`rounded-xl border p-3.5 text-left transition-colors ${
                          isSelected
                            ? 'border-[#0A192F] bg-[#0A192F] text-white'
                            : isAllowed
                              ? 'border-slate-200 bg-white text-slate-900 hover:border-slate-400'
                              : 'border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold">{getTerminLabel(t)}</span>
                          {alreadyBilled ? (
                            <CheckCircle2
                              className={`h-4 w-4 ${isSelected ? 'text-emerald-400' : 'text-emerald-600'}`}
                            />
                          ) : !isAllowed ? (
                            <Lock className="h-3.5 w-3.5 text-slate-400" />
                          ) : null}
                        </div>
                        <div
                          className={`mt-1 text-[11px] leading-snug ${
                            isSelected ? 'text-slate-200' : 'text-slate-500'
                          }`}
                        >
                          {isSelected && isAllowed
                            ? 'Aktif dipilih untuk penagihan'
                            : reason || 'Tersedia untuk dibuat'}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Invoice Number, Date, Period, Efaktur */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-1.5">
                  <label
                    htmlFor="invoice-number-input"
                    className="block text-xs font-semibold text-slate-700"
                  >
                    Nomor Invoice {mode === 'NEW' && !isEdit ? '(Otomatis)' : '(Manual)'}
                  </label>
                  <input
                    id="invoice-number-input"
                    type="text"
                    value={activeInvoiceNumber}
                    readOnly={mode === 'NEW' && !isEdit}
                    onChange={(e) => setManualInvoiceNumber(e.target.value)}
                    placeholder="Contoh: 850/INV/CLX/XI/2026"
                    className={`w-full rounded-lg border px-3 py-2 font-mono text-xs focus:outline-none ${
                      mode === 'NEW' && !isEdit
                        ? 'border-slate-200 bg-slate-100 text-slate-700 cursor-not-allowed'
                        : 'border-slate-200 bg-white text-slate-900 focus:border-slate-900'
                    }`}
                  />
                  {mode === 'NEW' && !isEdit && (
                    <p className="text-[10px] text-slate-500">
                      Counter berlanjut otomatis lintas semua customer
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="invoice-date-input"
                    className="block text-xs font-semibold text-slate-700"
                  >
                    Tanggal Invoice (DD-MMM-YYYY)
                  </label>
                  <input
                    id="invoice-date-input"
                    type="date"
                    value={invoiceDate}
                    onChange={(e) => {
                      setInvoiceDate(e.target.value);
                      setPeriod(formatPeriodDisplay(e.target.value));
                    }}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 tabular-nums focus:border-slate-900 focus:outline-none"
                  />
                  <p className="text-[10px] text-slate-500 tabular-nums">
                    PDF: {formatDateDdMmmYyyy(invoiceDate)}
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="invoice-period-input"
                    className="block text-xs font-semibold text-slate-700"
                  >
                    Period (MMM-YYYY)
                  </label>
                  <input
                    id="invoice-period-input"
                    type="text"
                    value={period}
                    onChange={(e) => setPeriod(e.target.value)}
                    placeholder="Nov-2026"
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-slate-900 focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="invoice-efaktur-input"
                    className="block text-xs font-semibold text-slate-700"
                  >
                    No. Efaktur (Opsional)
                  </label>
                  <input
                    id="invoice-efaktur-input"
                    type="text"
                    value={noEfaktur}
                    onChange={(e) => setNoEfaktur(e.target.value)}
                    placeholder="010.004-26.xxxxxxxx"
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-xs text-slate-900 focus:border-slate-900 focus:outline-none"
                  />
                </div>
              </div>

              {/* Legacy initial payment status */}
              {mode === 'LEGACY' && !isEdit && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <div className="space-y-1.5">
                    <label
                      htmlFor="legacy-payment-status"
                      className="block text-xs font-semibold text-slate-700"
                    >
                      Status Pembayaran (Legacy)
                    </label>
                    <select
                      id="legacy-payment-status"
                      value={legacyPaymentStatus}
                      onChange={(e) => setLegacyPaymentStatus(e.target.value as PaymentStatus)}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-slate-900 focus:outline-none"
                    >
                      <option value="PAID">Sudah Terbayar (PAID)</option>
                      <option value="UNPAID">Belum Terbayar (UNPAID)</option>
                    </select>
                  </div>

                  {legacyPaymentStatus === 'PAID' && (
                    <>
                      <div className="space-y-1.5">
                        <label
                          htmlFor="legacy-paid-date"
                          className="block text-xs font-semibold text-slate-700"
                        >
                          Tanggal Bayar
                        </label>
                        <input
                          id="legacy-paid-date"
                          type="date"
                          value={legacyPaidDate}
                          onChange={(e) => setLegacyPaidDate(e.target.value)}
                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 tabular-nums focus:border-slate-900 focus:outline-none"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label
                          htmlFor="legacy-payment-ref"
                          className="block text-xs font-semibold text-slate-700"
                        >
                          Referensi Transfer / Catatan
                        </label>
                        <input
                          id="legacy-payment-ref"
                          type="text"
                          value={legacyPaymentRef}
                          onChange={(e) => setLegacyPaymentRef(e.target.value)}
                          placeholder="BCA-TRF/..."
                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-slate-900 focus:outline-none"
                        />
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Line Items Table */}
              <div className="space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="text-xs font-semibold text-slate-700">
                      Rincian Pekerjaan (Nilai Kontrak 100%)
                    </span>
                    {!selectedIsVgreen && (
                      <p className="text-[11px] text-slate-500">
                        Customer non-Vgreen: masukkan Item Description secara manual sesuai pekerjaan/PO.
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="inline-flex items-center gap-1 text-xs font-medium text-slate-700 hover:text-slate-900"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Tambah Baris Item</span>
                  </button>
                </div>

                <div className="overflow-x-auto rounded-lg border border-slate-200">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-500">
                        <th className="py-2 px-3">Item Description</th>
                        <th className="py-2 px-3 w-20">Qty</th>
                        <th className="py-2 px-3 w-24">UOM</th>
                        <th className="py-2 px-3 w-40">Unit Price (IDR)</th>
                        <th className="py-2 px-3 w-36 text-right">Amount</th>
                        <th className="py-2 px-2 w-10" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {items.map((item, idx) => (
                        <tr key={item.id}>
                          <td className="p-2">
                            <input
                              type="text"
                              value={item.description}
                              onChange={(e) => handleItemChange(idx, 'description', e.target.value)}
                              placeholder={
                                selectedIsVgreen
                                  ? 'Deskripsi pekerjaan / lokasi'
                                  : 'Ketik Item Description secara manual...'
                              }
                              aria-label={`Deskripsi item ${idx + 1}`}
                              className="w-full rounded border border-slate-200 px-2.5 py-1.5 text-xs text-slate-900 focus:border-slate-900 focus:outline-none"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="number"
                              min={1}
                              value={item.qty}
                              onChange={(e) => handleItemChange(idx, 'qty', Number(e.target.value))}
                              aria-label={`Qty item ${idx + 1}`}
                              className="w-full rounded border border-slate-200 px-2.5 py-1.5 text-xs text-slate-900 tabular-nums focus:border-slate-900 focus:outline-none"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="text"
                              value={item.uom}
                              onChange={(e) => handleItemChange(idx, 'uom', e.target.value)}
                              aria-label={`UOM item ${idx + 1}`}
                              className="w-full rounded border border-slate-200 px-2.5 py-1.5 text-xs text-slate-900 focus:border-slate-900 focus:outline-none"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="number"
                              min={0}
                              step={1000}
                              value={item.unitPrice}
                              onChange={(e) =>
                                handleItemChange(idx, 'unitPrice', Number(e.target.value))
                              }
                              aria-label={`Harga satuan item ${idx + 1}`}
                              className="w-full rounded border border-slate-200 px-2.5 py-1.5 text-xs text-slate-900 text-right tabular-nums focus:border-slate-900 focus:outline-none"
                            />
                          </td>
                          <td className="p-2 text-right font-mono font-semibold text-slate-900 tabular-nums">
                            {formatRupiah(item.amount)}
                          </td>
                          <td className="p-2 text-center">
                            <button
                              type="button"
                              disabled={items.length <= 1}
                              onClick={() => handleRemoveItem(idx)}
                              aria-label={`Hapus item ${idx + 1}`}
                              className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-red-600 disabled:opacity-30"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Totals & Bill To Preview/Override */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-7 space-y-3">
                  <div className="space-y-1.5">
                    <label
                      htmlFor="bill-to-name"
                      className="block text-xs font-semibold text-slate-700"
                    >
                      Bill To (Nama Perusahaan Customer)
                    </label>
                    <input
                      id="bill-to-name"
                      type="text"
                      value={billToName}
                      onChange={(e) => setBillToName(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-slate-900 focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label
                      htmlFor="bill-to-address"
                      className="block text-xs font-semibold text-slate-700"
                    >
                      Alamat Bill To
                    </label>
                    <textarea
                      id="bill-to-address"
                      rows={2}
                      value={billToAddress}
                      onChange={(e) => setBillToAddress(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-slate-900 focus:outline-none"
                    />
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5">
                    <div className="text-[11px] font-medium text-slate-500">
                      Total Amount In Words
                    </div>
                    <div className="mt-0.5 text-xs font-semibold text-slate-900">
                      {amounts.amountInWords}
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-5 rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2.5 text-xs">
                  <div className="flex items-center justify-between text-slate-600">
                    <span>Total Nilai Kontrak (100%)</span>
                    <span className="font-mono font-semibold text-slate-900 tabular-nums">
                      {formatRupiahWithPrefix(amounts.contractAmount)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-slate-600">
                    <span>{getTerminLabel(termin)}</span>
                    <span className="font-mono font-semibold text-slate-900 tabular-nums">
                      {formatRupiahWithPrefix(amounts.terminAmount)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3 text-slate-600">
                    <label htmlFor="tax-rate-input" className="flex items-center gap-1.5">
                      <span>PPN / Tax (%)</span>
                      <input
                        id="tax-rate-input"
                        type="number"
                        min={0}
                        max={30}
                        step={0.5}
                        value={taxRate}
                        onChange={(e) => setTaxRate(Number(e.target.value))}
                        className="w-14 rounded border border-slate-300 bg-white px-1.5 py-0.5 text-right font-mono text-xs text-slate-900 tabular-nums"
                      />
                    </label>
                    <span className="font-mono font-semibold text-slate-900 tabular-nums">
                      {formatRupiahWithPrefix(amounts.taxAmount)}
                    </span>
                  </div>
                  <div className="border-t border-slate-200 pt-2.5 flex items-center justify-between">
                    <span className="font-display text-sm font-bold text-slate-900">
                      Grand Total
                    </span>
                    <span className="font-mono text-base font-bold text-slate-900 tabular-nums">
                      {formatRupiahWithPrefix(amounts.grandTotal)}
                    </span>
                  </div>
                </div>
              </div>

              {errorMsg && (
                <div
                  role="alert"
                  className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700"
                >
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}
            </div>

            {/* Pinned Footer Actions */}
            <div className="flex shrink-0 items-center justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-3.5">
              <button
                type="button"
                onClick={onClose}
                disabled={isSaving}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={
                  isSaving ||
                  (!isEdit && selectedIsVgreen && availability.allowedTermins.length === 0)
                }
                className="rounded-lg bg-[#0A192F] px-5 py-2 text-sm font-medium text-white hover:bg-[#142B4F] transition-colors disabled:opacity-50 whitespace-nowrap"
              >
                {isSaving
                  ? 'Menyimpan ke Sheet...'
                  : isEdit
                    ? 'Simpan Perubahan'
                    : 'Simpan & Terbitkan Invoice'}
              </button>
            </div>
          </form>
        </div>
      </div>

      <ConfirmDialog
        open={Boolean(pendingConfirmInvoice)}
        title="Konfirmasi Perubahan Invoice"
        description="Perubahan ini akan memperbarui data baris invoice di Google Sheet secara langsung. Pastikan rincian nominal dan nomor Efaktur sudah sesuai."
        details={
          pendingConfirmInvoice
            ? [
                { label: 'No. Invoice', value: pendingConfirmInvoice.invoiceNumber },
                { label: 'Customer', value: pendingConfirmInvoice.billToName },
                { label: 'Proyek / Item', value: pendingConfirmInvoice.projectLocation },
                { label: 'Termin', value: pendingConfirmInvoice.terminLabel },
                {
                  label: 'Grand Total',
                  value: formatRupiahWithPrefix(pendingConfirmInvoice.grandTotal),
                },
              ]
            : undefined
        }
        confirmLabel="Ya, Perbarui Invoice"
        isLoading={isSaving}
        onCancel={() => setPendingConfirmInvoice(null)}
        onConfirm={async () => {
          if (!pendingConfirmInvoice) return;
          const toSave = pendingConfirmInvoice;
          setPendingConfirmInvoice(null);
          await onSave(toSave, true);
        }}
      />
    </>
  );
};
