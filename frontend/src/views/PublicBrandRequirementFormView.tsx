import React, { useEffect, useRef, useState } from 'react';
import {
  Briefcase, FileText, CheckCircle2, Send, Building2,
  User, Link2, IndianRupee, Gift, Sparkles,
  AlertCircle, Loader2, Users, Calendar, ChevronDown, Search, Plus, Check, Video
} from 'lucide-react';
import { api } from '../services/api';

const PRODUCT_CATEGORIES = [
  'Fashion & Styling',
  'Beauty, Makeup & Skincare',
  'Health & Fitness',
  'Food & Culinary',
  'Lifestyle & Daily Vlogs',
  'Tech & Gadgets',
  'Travel & Adventure',
  'Comedy & Entertainment',
  'Parenting & Kids',
  'Finance & Crypto',
  'Gaming & Esports',
  'Home & Living',
  'Jewelry & Accessories',
  'Other'
];

const FOLLOWER_TIERS = [
  'Any',
  '1k – 10k (Nano Creator)',
  '10k – 50k (Micro Creator)',
  '50k – 100k (Mid-Tier Creator)',
  '100k – 500k (Macro Creator)',
  '500k+ (Celebrity / Mega Creator)'
];

const TEAM_OPTIONS = [
  'Ad Buyers',
  'Marketing Team',
  'Brand Team',
  'Performance Marketing',
  'Operations',
  'Other'
];

const DELIVERABLES_PRESETS = [
  '1 Dedicated Reel',
  '1 Story',
  '2 Dedicated Reels',
  '2 Stories',
  '1 Product Unboxing Video',
  '1 Story Series (3 Frames)',
  '1 Integrated Video',
  'Collaborative Post',
  'Photo Carousel Post',
  'Link in Bio (24 Hrs)'
];

interface PublicBrandOption {
  _id: string;
  brandId: string;
  brandName: string;
  industry?: string;
}

const DEFAULT_FORM = {
  submittedByName: '',
  submittedByTeam: 'Ad Buyers',
  brandId: '',
  brandName: '',
  productCategory: 'Fashion & Styling',
  productLink: '',
  collabType: 'Barter' as 'Barter' | 'Paid' | 'Both',
  budgetPerCreator: '',
  deliverables: '1 Dedicated Reel + 1 Story',
  collabDescription: '',
  creatorRequirements: '',
  targetFollowerTier: 'Any',
  creatorsNeeded: '1',
  refVideoLink: '',
  targetTimeline: ''
};

export const PublicBrandRequirementFormView: React.FC = () => {
  const [formData, setFormData] = useState(DEFAULT_FORM);
  const [brands, setBrands] = useState<PublicBrandOption[]>([]);
  const [loadingBrands, setLoadingBrands] = useState(true);

  const [showBrandDropdown, setShowBrandDropdown] = useState(false);
  const [brandSearch, setBrandSearch] = useState('');
  const [isCustomBrand, setIsCustomBrand] = useState(false);
  const [customBrandName, setCustomBrandName] = useState('');
  const brandDropdownRef = useRef<HTMLDivElement>(null);

  const [showDeliverablesDropdown, setShowDeliverablesDropdown] = useState(false);
  const [deliverableOptions, setDeliverableOptions] = useState<string[]>(DELIVERABLES_PRESETS);
  const [newDeliverable, setNewDeliverable] = useState('');
  const deliverablesDropdownRef = useRef<HTMLDivElement>(null);

  const [submitting, setSubmitting] = useState(false);
  const [submittedRecord, setSubmittedRecord] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const loadBrands = async () => {
      try {
        const res = await api.get('/brand-requirements/public-brands');
        if (res.success && Array.isArray(res.data)) {
          setBrands(res.data);
        }
      } catch (err) {
        console.error('Failed to load brand list:', err);
      } finally {
        setLoadingBrands(false);
      }
    };
    loadBrands();
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (brandDropdownRef.current && !brandDropdownRef.current.contains(e.target as Node)) {
        setShowBrandDropdown(false);
      }
      if (deliverablesDropdownRef.current && !deliverablesDropdownRef.current.contains(e.target as Node)) {
        setShowDeliverablesDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errorMsg) setErrorMsg('');
  };

  const filteredBrands = brands.filter(b => {
    if (!brandSearch.trim()) return true;
    const q = brandSearch.trim().toLowerCase();
    return (
      b.brandName.toLowerCase().includes(q) ||
      (b.industry || '').toLowerCase().includes(q) ||
      (b.brandId || '').toLowerCase().includes(q)
    );
  });

  const isDeliverableSelected = (chip: string) => {
    if (!formData.deliverables) return false;
    const parts = formData.deliverables
      .split(/\s*(?:\+|\band\b|,)\s*/i)
      .map(p => p.trim().toLowerCase())
      .filter(Boolean);
    return parts.some(p => p === chip.toLowerCase() || p.includes(chip.toLowerCase()));
  };

  const handleToggleDeliverable = (chip: string) => {
    const current = (formData.deliverables || '').trim();
    if (!current) {
      setFormData(prev => ({ ...prev, deliverables: chip }));
      return;
    }
    const items = current
      .split(/\s*(?:\+|\band\b|,)\s*/i)
      .map(s => s.trim())
      .filter(Boolean);
    const idx = items.findIndex(item => item.toLowerCase() === chip.toLowerCase() || item.toLowerCase().includes(chip.toLowerCase()));
    if (idx >= 0) items.splice(idx, 1);
    else items.push(chip);
    setFormData(prev => ({ ...prev, deliverables: items.join(' + ') }));
  };

  const handleAddCustomDeliverable = () => {
    const trimmed = newDeliverable.trim();
    if (!trimmed) return;
    if (!deliverableOptions.some(o => o.toLowerCase() === trimmed.toLowerCase())) {
      setDeliverableOptions(prev => [...prev, trimmed]);
    }
    const current = (formData.deliverables || '').trim();
    if (!current) {
      setFormData(prev => ({ ...prev, deliverables: trimmed }));
    } else {
      const items = current.split(/\s*(?:\+|\band\b|,)\s*/i).map(s => s.trim()).filter(Boolean);
      if (!items.some(i => i.toLowerCase() === trimmed.toLowerCase())) {
        items.push(trimmed);
        setFormData(prev => ({ ...prev, deliverables: items.join(' + ') }));
      }
    }
    setNewDeliverable('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const finalBrandName = isCustomBrand ? customBrandName.trim() : formData.brandName.trim();

    if (!formData.submittedByName.trim()) {
      setErrorMsg('Please enter your name (Ad Buyer / Marketing member).');
      return;
    }
    if (!finalBrandName) {
      setErrorMsg('Please select or enter the brand name.');
      return;
    }
    if (!formData.collabDescription.trim()) {
      setErrorMsg('Please provide the collaboration description / brief.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.post('/brand-requirements/submit', {
        brandId: isCustomBrand ? '' : formData.brandId,
        brandName: finalBrandName,
        productCategory: formData.productCategory,
        productLink: formData.productLink.trim(),
        collabType: formData.collabType,
        budgetPerCreator: Number(formData.budgetPerCreator) || 0,
        deliverables: formData.deliverables.trim(),
        collabDescription: formData.collabDescription.trim(),
        creatorRequirements: formData.creatorRequirements.trim(),
        targetFollowerTier: formData.targetFollowerTier,
        creatorsNeeded: Math.max(1, Number(formData.creatorsNeeded) || 1),
        refVideoLink: formData.refVideoLink.trim(),
        targetTimeline: formData.targetTimeline.trim(),
        submittedByName: formData.submittedByName.trim(),
        submittedByTeam: formData.submittedByTeam,
        source: 'Ad Buyer & Marketing Brief Form'
      });

      if (res.success) {
        setSubmittedRecord(res.data);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        setErrorMsg(res.message || 'Failed to submit requirement.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Something went wrong while submitting.');
    } finally {
      setSubmitting(false);
    }
  };

  if (submittedRecord) {
    return (
      <div className="min-h-screen bg-slate-50/70 text-slate-800 flex flex-col justify-center items-center px-4 py-12">
        <div className="w-full max-w-lg bg-white border border-slate-200/80 rounded-3xl p-8 sm:p-10 text-center shadow-xl shadow-indigo-500/5 relative overflow-hidden">
          <div className="absolute -top-24 -left-24 w-48 h-48 bg-indigo-200/40 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-emerald-200/40 rounded-full blur-3xl pointer-events-none" />

          <div className="w-20 h-20 bg-gradient-to-tr from-indigo-600 to-purple-600 rounded-3xl mx-auto flex items-center justify-center shadow-lg shadow-indigo-500/25 mb-6">
            <CheckCircle2 size={44} className="text-white" />
          </div>

          <span className="inline-block px-3 py-1 bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs font-black tracking-widest uppercase rounded-full mb-3">
            Brief Saved • {submittedRecord.requirementCode}
          </span>

          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mb-2">
            Product Brief Submitted!
          </h2>
          <p className="text-slate-600 text-sm leading-relaxed mb-6">
            Thank you, <strong>{submittedRecord.submittedByName}</strong>. Your product requirement is now live in the <strong>Brand &amp; Product Briefs</strong> panel for product-wise influencer allotment.
          </p>

          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 mb-6 text-left space-y-2.5 text-xs sm:text-sm">
            <div className="flex justify-between gap-2">
              <span className="text-slate-500 font-semibold">Brand</span>
              <span className="font-black text-slate-900 text-right">{submittedRecord.brandName}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-slate-500 font-semibold">Category</span>
              <span className="font-bold text-indigo-700 text-right">{submittedRecord.productCategory}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-slate-500 font-semibold">Collab Mode</span>
              <span className="font-bold text-slate-800">{submittedRecord.collabType}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-slate-500 font-semibold">Deliverables</span>
              <span className="font-bold text-slate-800 text-right">{submittedRecord.deliverables}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-slate-500 font-semibold">Creators Needed</span>
              <span className="font-bold text-slate-800">{submittedRecord.creatorsNeeded} creator(s)</span>
            </div>
            {submittedRecord.targetTimeline && (
              <div className="flex justify-between gap-2">
                <span className="text-slate-500 font-semibold">Target Timeline</span>
                <span className="font-bold text-slate-800">{submittedRecord.targetTimeline}</span>
              </div>
            )}
          </div>

          <button
            onClick={() => {
              setSubmittedRecord(null);
              setFormData(DEFAULT_FORM);
              setIsCustomBrand(false);
              setCustomBrandName('');
            }}
            className="w-full py-3 px-6 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs sm:text-sm transition cursor-pointer shadow-md shadow-indigo-500/20"
          >
            Submit Another Product Requirement
          </button>
        </div>

        <p className="mt-8 text-xs text-slate-500 text-center">
          Powered by <strong>Ad2ship Influencer Marketing Operations</strong> &bull; Internal Ad Buyers &amp; Marketing Portal
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/70 text-slate-800 flex flex-col justify-between relative overflow-x-hidden">
      <div className="absolute top-12 left-1/2 -translate-x-1/2 w-[850px] h-[360px] bg-gradient-to-tr from-indigo-200/35 via-blue-100/25 to-purple-200/25 blur-3xl pointer-events-none -z-10" />

      {/* Top Banner */}
      <header className="border-b border-slate-200/80 bg-white/95 backdrop-blur-xl sticky top-0 z-30 shadow-xs">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center space-x-3.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 via-blue-600 to-purple-600 flex items-center justify-center shadow-md shadow-indigo-500/25">
              <Briefcase className="text-white" size={20} />
            </div>
            <div>
              <div className="font-bold text-base sm:text-lg tracking-tight text-slate-900">
                Ad2ship Brand Briefs
              </div>
              <div className="text-xs text-slate-500 font-medium">Ad Buyers &amp; Marketing Team • Product Requirement Form</div>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200/80 px-3 py-1 rounded-full shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" /> Internal Campaign Intake
          </span>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto w-full px-4 sm:px-6 py-8 sm:py-10">
        <div className="text-center mb-8 max-w-3xl mx-auto">
          <h1 className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight leading-[1.15]">
            Submit{' '}
            <span className="bg-gradient-to-r from-indigo-600 via-blue-600 to-purple-600 bg-clip-text text-transparent">
              Brand &amp; Product Collaboration
            </span>{' '}
            Requirements
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 font-medium mt-2">
            For Ad Buyers &amp; Marketing Team — briefs submitted here sync directly to the Influencer Operations Hub for product-wise creator allotment.
          </p>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-10 shadow-xl shadow-indigo-900/5">
          {errorMsg && (
            <div className="mb-6 p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-3 text-rose-800 text-xs sm:text-sm">
              <AlertCircle size={18} className="shrink-0 mt-0.5 text-rose-600" />
              <div>{errorMsg}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Section 1: Ad Buyer / Marketing Team Submitter */}
            <div>
              <div className="flex items-center gap-3 pb-3 mb-5 border-b border-slate-100">
                <div className="w-7 h-7 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs">
                  1
                </div>
                <h3 className="font-bold text-base sm:text-lg text-slate-900 tracking-tight">
                  Ad Buyer / Marketing Team Details
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Your Name <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-3 text-slate-400" size={16} />
                    <input
                      type="text"
                      name="submittedByName"
                      value={formData.submittedByName}
                      onChange={handleChange}
                      placeholder="e.g. Rohan Verma"
                      required
                      className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm focus:outline-none focus:border-indigo-600 focus:bg-white transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Team / Department <span className="text-rose-500">*</span>
                  </label>
                  <select
                    name="submittedByTeam"
                    value={formData.submittedByTeam}
                    onChange={handleChange}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm font-semibold focus:outline-none focus:border-indigo-600 focus:bg-white transition"
                  >
                    {TEAM_OPTIONS.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Section 2: Brand & Product Details */}
            <div>
              <div className="flex items-center gap-3 pb-3 mb-5 border-b border-slate-100">
                <div className="w-7 h-7 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-xs">
                  2
                </div>
                <h3 className="font-bold text-base sm:text-lg text-slate-900 tracking-tight">
                  Brand &amp; Product Details
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Searchable Brand Selector */}
                <div ref={brandDropdownRef} className="relative">
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Brand Name <span className="text-rose-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowBrandDropdown(prev => !prev)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 hover:border-indigo-400 rounded-xl text-left text-sm flex items-center justify-between cursor-pointer transition"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Building2 size={16} className="text-indigo-600 shrink-0" />
                      {isCustomBrand ? (
                        <span className="font-bold text-indigo-800 truncate">
                          {customBrandName.trim() ? `Custom: ${customBrandName}` : '+ Other / New Brand'}
                        </span>
                      ) : formData.brandName ? (
                        <span className="font-bold text-slate-900 truncate">{formData.brandName}</span>
                      ) : (
                        <span className="text-slate-400">
                          {loadingBrands ? 'Loading brands...' : 'Select brand from portfolio...'}
                        </span>
                      )}
                    </div>
                    <ChevronDown size={16} className={`text-slate-400 shrink-0 transition-transform ${showBrandDropdown ? 'rotate-180 text-indigo-600' : ''}`} />
                  </button>

                  {showBrandDropdown && (
                    <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden">
                      <div className="p-2 border-b border-slate-100 bg-slate-50">
                        <div className="relative flex items-center">
                          <Search size={14} className="absolute left-3 text-slate-400" />
                          <input
                            type="text"
                            autoFocus
                            value={brandSearch}
                            onChange={e => setBrandSearch(e.target.value)}
                            placeholder="Search brand name..."
                            className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-indigo-500"
                          />
                        </div>
                      </div>
                      <div className="max-h-56 overflow-y-auto p-1.5 space-y-1">
                        {filteredBrands.map(b => (
                          <button
                            type="button"
                            key={b._id}
                            onClick={() => {
                              setIsCustomBrand(false);
                              setFormData(prev => ({ ...prev, brandId: b._id, brandName: b.brandName }));
                              setShowBrandDropdown(false);
                              setBrandSearch('');
                            }}
                            className={`w-full px-3 py-2 rounded-xl text-left text-xs font-bold flex items-center justify-between cursor-pointer ${
                              !isCustomBrand && formData.brandName === b.brandName
                                ? 'bg-indigo-50 text-indigo-900 border border-indigo-200'
                                : 'hover:bg-slate-50 text-slate-700'
                            }`}
                          >
                            <span className="truncate">{b.brandName} {b.industry ? `(${b.industry})` : ''}</span>
                            {!isCustomBrand && formData.brandName === b.brandName && <CheckCircle2 size={14} className="text-indigo-600 shrink-0" />}
                          </button>
                        ))}

                        <div className="pt-1 border-t border-slate-100">
                          <button
                            type="button"
                            onClick={() => {
                              setIsCustomBrand(true);
                              setShowBrandDropdown(false);
                              setBrandSearch('');
                            }}
                            className="w-full px-3 py-2 rounded-xl text-left text-xs font-bold text-indigo-700 hover:bg-indigo-50 flex items-center gap-1.5 cursor-pointer"
                          >
                            <Plus size={14} /> Other / New Brand (Type Manually)
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {isCustomBrand && (
                    <input
                      type="text"
                      value={customBrandName}
                      onChange={e => setCustomBrandName(e.target.value)}
                      placeholder="Enter brand name..."
                      className="mt-2 w-full px-3.5 py-2 bg-white border border-indigo-300 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:border-indigo-600"
                    />
                  )}
                </div>

                {/* Product Category */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Product Category / Niche
                  </label>
                  <select
                    name="productCategory"
                    value={formData.productCategory}
                    onChange={handleChange}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm font-semibold focus:outline-none focus:border-indigo-600 focus:bg-white transition"
                  >
                    {PRODUCT_CATEGORIES.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                {/* Product Link */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Product Link / Store URL (optional)
                  </label>
                  <div className="relative">
                    <Link2 className="absolute left-3.5 top-3 text-slate-400" size={16} />
                    <input
                      type="url"
                      name="productLink"
                      value={formData.productLink}
                      onChange={handleChange}
                      placeholder="https://brandstore.com/products/..."
                      className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm focus:outline-none focus:border-indigo-600 focus:bg-white transition"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Section 3: Collab Brief & Requirements */}
            <div>
              <div className="flex items-center gap-3 pb-3 mb-5 border-b border-slate-100">
                <div className="w-7 h-7 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs">
                  3
                </div>
                <h3 className="font-bold text-base sm:text-lg text-slate-900 tracking-tight">
                  Collaboration Description &amp; Creator Requirements
                </h3>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Collab Mode */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Collaboration Mode <span className="text-rose-500">*</span>
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {(['Barter', 'Paid', 'Both'] as const).map(mode => (
                        <button
                          type="button"
                          key={mode}
                          onClick={() => setFormData(prev => ({ ...prev, collabType: mode }))}
                          className={`py-2.5 px-2 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition ${
                            formData.collabType === mode
                              ? 'bg-indigo-50 border-indigo-500 text-indigo-900 ring-2 ring-indigo-500/20'
                              : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          {mode === 'Barter' ? <Gift size={13} /> : mode === 'Paid' ? <IndianRupee size={13} /> : <Sparkles size={13} />}
                          <span>{mode}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Creators Needed */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Creators Needed
                      </label>
                      <div className="relative">
                        <Users className="absolute left-3 top-3 text-slate-400" size={15} />
                        <input
                          type="number"
                          min={1}
                          name="creatorsNeeded"
                          value={formData.creatorsNeeded}
                          onChange={handleChange}
                          className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:outline-none focus:border-indigo-600 focus:bg-white"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Target Tier
                      </label>
                      <select
                        name="targetFollowerTier"
                        value={formData.targetFollowerTier}
                        onChange={handleChange}
                        className="w-full px-2.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold focus:outline-none focus:border-indigo-600 focus:bg-white"
                      >
                        {FOLLOWER_TIERS.map(tier => (
                          <option key={tier} value={tier}>{tier}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Budget per creator (for Paid / Both) */}
                {(formData.collabType === 'Paid' || formData.collabType === 'Both') && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Target Budget / Payout per Creator (₹ INR)
                    </label>
                    <div className="relative">
                      <IndianRupee className="absolute left-3.5 top-3 text-amber-600" size={16} />
                      <input
                        type="number"
                        name="budgetPerCreator"
                        value={formData.budgetPerCreator}
                        onChange={handleChange}
                        placeholder="e.g. 2500"
                        className="w-full pl-10 pr-3.5 py-2.5 bg-amber-50/40 border border-amber-200 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:border-amber-500 focus:bg-white"
                      />
                    </div>
                  </div>
                )}

                {/* Deliverables Multi-select */}
                <div ref={deliverablesDropdownRef} className="relative">
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Expected Deliverables (optional)
                  </label>
                  <div className="relative flex items-center">
                    <input
                      type="text"
                      name="deliverables"
                      value={formData.deliverables}
                      onChange={handleChange}
                      placeholder="e.g. 1 Dedicated Reel + 1 Story"
                      className="w-full pl-3.5 pr-11 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:border-indigo-600 focus:bg-white"
                    />
                    <button
                      type="button"
                      onClick={() => setShowDeliverablesDropdown(prev => !prev)}
                      className="absolute right-2 p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg cursor-pointer"
                    >
                      <ChevronDown size={17} className={`transition-transform ${showDeliverablesDropdown ? 'rotate-180 text-indigo-600' : ''}`} />
                    </button>
                  </div>

                  {showDeliverablesDropdown && (
                    <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white border border-slate-200 rounded-2xl shadow-xl p-3 max-h-64 overflow-y-auto">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                        {deliverableOptions.map(chip => {
                          const selected = isDeliverableSelected(chip);
                          return (
                            <button
                              type="button"
                              key={chip}
                              onClick={() => handleToggleDeliverable(chip)}
                              className={`px-2.5 py-2 rounded-xl text-xs font-bold flex items-center justify-between cursor-pointer ${
                                selected ? 'bg-indigo-50 text-indigo-900 border border-indigo-200' : 'hover:bg-slate-50 text-slate-700'
                              }`}
                            >
                              <span className="truncate">{chip}</span>
                              {selected && <Check size={13} className="text-indigo-600 shrink-0" />}
                            </button>
                          );
                        })}
                      </div>
                      <div className="pt-2 mt-2 border-t border-slate-100 flex gap-2">
                        <input
                          type="text"
                          value={newDeliverable}
                          onChange={e => setNewDeliverable(e.target.value)}
                          placeholder="+ Custom deliverable..."
                          className="flex-1 px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500"
                        />
                        <button
                          type="button"
                          onClick={handleAddCustomDeliverable}
                          className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold cursor-pointer"
                        >
                          Add
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Collaboration Description */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Description for Collab (Concept, Hooks &amp; Product USPs) <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <FileText className="absolute left-3.5 top-3 text-slate-400" size={16} />
                    <textarea
                      name="collabDescription"
                      rows={3}
                      required
                      value={formData.collabDescription}
                      onChange={handleChange}
                      placeholder="Explain the video concept, product highlights, key talking points, CTA, and shoot style..."
                      className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:border-indigo-600 focus:bg-white transition"
                    />
                  </div>
                </div>

                {/* Creator Requirements */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Creator Requirements &amp; Eligibility (optional)
                  </label>
                  <textarea
                    name="creatorRequirements"
                    rows={3}
                    value={formData.creatorRequirements}
                    onChange={handleChange}
                    placeholder="e.g. Female skincare/beauty creators aged 20-32 in Tier-1/Tier-2 cities, Hindi/English speaking, clean aesthetic & high reel engagement..."
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:border-indigo-600 focus:bg-white transition"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Reference Video / Brief Link (optional)
                    </label>
                    <div className="relative">
                      <Video className="absolute left-3.5 top-3 text-slate-400" size={16} />
                      <input
                        type="url"
                        name="refVideoLink"
                        value={formData.refVideoLink}
                        onChange={handleChange}
                        placeholder="https://instagram.com/reel/... or Drive brief link"
                        className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-indigo-600 focus:bg-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Target Timeline (optional)
                    </label>
                    <div className="relative">
                      <Calendar className="absolute left-3.5 top-3 text-slate-400 pointer-events-none" size={16} />
                      <input
                        type="date"
                        name="targetTimeline"
                        value={formData.targetTimeline}
                        onChange={handleChange}
                        className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:border-indigo-600 focus:bg-white"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-indigo-600 via-blue-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-black text-sm sm:text-base flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/25 transition disabled:opacity-50 cursor-pointer"
              >
                {submitting ? (
                  <>
                    <Loader2 size={18} className="animate-spin" /> Saving Brand Product Brief...
                  </>
                ) : (
                  <>
                    <Send size={18} /> Submit Product Requirement to Panel
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </main>

      <footer className="py-6 text-center text-xs text-slate-400">
        &copy; {new Date().getFullYear()} Ad2ship Influencer Operations Hub &bull; Brand &amp; Product Collaboration Briefs
      </footer>
    </div>
  );
};

