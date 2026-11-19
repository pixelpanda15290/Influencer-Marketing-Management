import React, { useState } from 'react';
import { 
  Sparkles, Instagram, Send, CheckCircle2, Phone, Mail, User, 
  MapPin, Package, ArrowRight, ShieldCheck, HeartHandshake,
  AlertCircle, Loader2, Info
} from 'lucide-react';
import { api } from '../services/api';

const NICHE_OPTIONS = [
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
  'Other'
];

const FOLLOWER_TIERS = [
  '1k – 10k (Nano Creator)',
  '10k – 50k (Micro Creator)',
  '50k – 100k (Mid-Tier Creator)',
  '100k – 500k (Macro Creator)',
  '500k+ (Celebrity / Mega Creator)'
];

const CLOTHING_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'];

const DEFAULT_FORM_DATA = {
  fullName: '',
  whatsappNumber: '',
  email: '',
  instagramHandle: '',
  followersCountBracket: '10k – 50k (Micro Creator)',
  category: 'Fashion & Styling',
  otherCategory: '',
  city: '',
  state: '',
  collabTypePreference: 'Both' as 'Barter' | 'Paid' | 'Both',
  languages: 'Hindi, English',
  // Shipping Address
  addressLine: '',
  pincode: '',
  landmark: '',
  clothingSize: 'M',
  shoeSize: ''
};

export const PublicInfluencerFormView: React.FC = () => {
  const [formData, setFormData] = useState(DEFAULT_FORM_DATA);

  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errorMsg) setErrorMsg('');
  };

  const handleCleanInstagram = (raw: string) => {
    let clean = raw.trim();
    if (clean.includes('instagram.com/')) {
      const parts = clean.split('?')[0].split('#')[0].split('/').filter(Boolean);
      clean = parts.pop() || '';
    }
    clean = clean.replace(/^@/, '');
    return clean ? `@${clean}` : '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    // Validations
    if (!formData.fullName.trim()) {
      setErrorMsg('Please enter your full name');
      return;
    }
    if (!formData.whatsappNumber.trim() || formData.whatsappNumber.replace(/\D/g, '').length < 10) {
      setErrorMsg('Please enter a valid 10-digit WhatsApp phone number');
      return;
    }
    if (!formData.email.trim() || !formData.email.includes('@')) {
      setErrorMsg('Please enter a valid email address');
      return;
    }
    if (!formData.instagramHandle.trim()) {
      setErrorMsg('Please provide your Instagram profile handle or link');
      return;
    }
    if (!formData.city.trim()) {
      setErrorMsg('Please enter your current city');
      return;
    }
    if (formData.category === 'Other' && !formData.otherCategory.trim()) {
      setErrorMsg('Please specify your content niche');
      return;
    }

    setLoading(true);

    try {
      const isFashion = formData.category === 'Fashion & Styling';

      const payload = {
        fullName: formData.fullName.trim(),
        whatsappNumber: formData.whatsappNumber.trim(),
        email: formData.email.trim(),
        instagramHandle: handleCleanInstagram(formData.instagramHandle),
        followersCountBracket: formData.followersCountBracket,
        category: formData.category,
        otherCategory: formData.category === 'Other' ? formData.otherCategory.trim() : '',
        city: formData.city.trim(),
        state: formData.state.trim(),
        collabTypePreference: formData.collabTypePreference,
        costPerReel: 0,
        costPerStory: 0,
        languages: formData.languages.split(',').map(s => s.trim()).filter(Boolean),
        shippingAddress: {
          addressLine: formData.addressLine.trim(),
          city: formData.city.trim(),
          state: formData.state.trim(),
          pincode: formData.pincode.trim(),
          landmark: formData.landmark.trim(),
          clothingSize: isFashion ? formData.clothingSize : '',
          shoeSize: isFashion ? formData.shoeSize.trim() : ''
        },
        nicheDetails: isFashion ? {
          clothingSize: formData.clothingSize,
          shoeSize: formData.shoeSize.trim()
        } : (formData.category === 'Other' && formData.otherCategory.trim() ? {
          otherCategory: formData.otherCategory.trim()
        } : {}),
        source: 'WhatsApp Campaign Link'
      };

      const res = await api.post('/influencer-applications/submit', payload);
      if (res.success) {
        setSubmitted(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        setErrorMsg(res.message || 'Submission failed. Please check your details and try again.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Something went wrong while submitting. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // SUCCESS SCREEN (Light Panel Themed)
  if (submitted) {
    return (
      <div className="min-h-screen bg-slate-50/70 text-slate-800 flex flex-col justify-center items-center px-4 py-12">
        <div className="w-full max-w-lg bg-white border border-slate-200/80 rounded-3xl p-8 sm:p-10 text-center shadow-xl shadow-purple-500/5 relative overflow-hidden">
          {/* Subtle accent glow */}
          <div className="absolute -top-24 -left-24 w-48 h-48 bg-purple-200/40 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-pink-200/40 rounded-full blur-3xl pointer-events-none" />

          <div className="w-20 h-20 bg-gradient-to-tr from-emerald-500 to-teal-500 rounded-3xl mx-auto flex items-center justify-center shadow-lg shadow-emerald-500/25 mb-6">
            <CheckCircle2 size={44} className="text-white" />
          </div>

          <span className="inline-block px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-black tracking-widest uppercase rounded-full mb-3">
            Application Received
          </span>

          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mb-3">
            You're All Set, {formData.fullName.split(' ')[0]}!
          </h2>

          <p className="text-slate-600 text-sm sm:text-base leading-relaxed mb-6">
            Thank you for registering with <strong>Ad2ship Influencer Operations</strong>. Our campaign managers are reviewing your profile.
          </p>

          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 sm:p-5 mb-6 text-left space-y-3 text-xs sm:text-sm">
            <div className="flex items-start gap-2.5">
              <Sparkles className="text-purple-600 shrink-0 mt-0.5" size={17} />
              <div className="text-slate-700">
                <strong className="text-slate-900">Brand Allotment:</strong> When a campaign aligns with your niche ({formData.category}), our team will allot the brand to you.
              </div>
            </div>
            <div className="flex items-start gap-2.5">
              <Phone className="text-emerald-600 shrink-0 mt-0.5" size={17} />
              <div className="text-slate-700">
                <strong className="text-slate-900">WhatsApp &amp; Email Notification:</strong> You will instantly receive a WhatsApp alert &amp; campaign brief on <strong>{formData.whatsappNumber}</strong> &amp; <strong>{formData.email}</strong>.
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <button
              onClick={() => {
                setSubmitted(false);
                setFormData(DEFAULT_FORM_DATA);
              }}
              className="w-full py-3 px-6 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition"
            >
              Submit Another Application
            </button>
          </div>
        </div>

        <p className="mt-8 text-xs text-slate-500 text-center">
          Powered by <strong>Ad2ship Influencer Marketing Operations</strong> &bull; Media &amp; Brand Logistics Hub
        </p>
      </div>
    );
  }

  // PUBLIC FORM (Light Panel Themed)
  return (
    <div className="min-h-screen bg-slate-50/70 text-slate-800 flex flex-col justify-between relative overflow-x-hidden">
      {/* Background ambient decorative blurs */}
      <div className="absolute top-12 left-1/2 -translate-x-1/2 w-[850px] h-[360px] bg-gradient-to-tr from-purple-200/30 via-indigo-100/20 to-pink-200/25 blur-3xl pointer-events-none -z-10" />

      {/* Top Brand Banner */}
      <header className="border-b border-slate-200/80 bg-white/95 backdrop-blur-xl sticky top-0 z-30 shadow-xs">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center space-x-3.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-pink-500 flex items-center justify-center shadow-md shadow-purple-500/25">
              <Sparkles className="text-white" size={20} />
            </div>
            <div>
              <div className="font-bold text-base sm:text-lg tracking-tight text-slate-900">
                Ad2ship
              </div>
              <div className="text-xs text-slate-500 font-medium">Brand Collaborations &amp; PR Gifting</div>
            </div>
          </div>
          <div className="flex items-center">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-3 py-1 rounded-full shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Applications Open
            </span>
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="max-w-4xl mx-auto w-full px-4 sm:px-6 py-8 sm:py-12">
        {/* Hero Info */}
        <div className="text-center mb-8 max-w-3xl mx-auto">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900 tracking-tight leading-[1.15]">
            Partner with Leading Brands for{' '}
            <span className="bg-gradient-to-r from-purple-600 via-indigo-600 to-pink-600 bg-clip-text text-transparent">
              Paid Campaigns &amp; PR Gifting
            </span>
          </h1>
        </div>

        {/* Form Card */}
        <div className="bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-10 lg:p-12 shadow-xl shadow-purple-900/5">
          {errorMsg && (
            <div className="mb-6 p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-3 text-rose-800 text-xs sm:text-sm">
              <AlertCircle size={18} className="shrink-0 mt-0.5 text-rose-600" />
              <div>{errorMsg}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Section 1: Personal & Contact */}
            <div>
              <div className="flex items-center gap-3 pb-3 mb-6 border-b border-slate-100">
                <div className="w-7 h-7 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-xs shadow-2xs">
                  1
                </div>
                <h3 className="font-bold text-base sm:text-lg text-slate-900 tracking-tight">
                  Personal &amp; Contact Details
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Full Name <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-3 text-slate-400" size={17} />
                    <input
                      type="text"
                      name="fullName"
                      value={formData.fullName}
                      onChange={handleChange}
                      placeholder="e.g. Priya Sharma"
                      required
                      className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm placeholder:text-slate-400 focus:outline-none focus:border-purple-600 focus:bg-white focus:ring-2 focus:ring-purple-500/15 transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    WhatsApp Number <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3.5 top-3 text-emerald-600" size={17} />
                    <input
                      type="tel"
                      name="whatsappNumber"
                      value={formData.whatsappNumber}
                      onChange={handleChange}
                      placeholder="e.g. 9876543210"
                      required
                      className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm placeholder:text-slate-400 focus:outline-none focus:border-purple-600 focus:bg-white focus:ring-2 focus:ring-purple-500/15 transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Email Address <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-3 text-slate-400" size={17} />
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      placeholder="e.g. priya.collabs@gmail.com"
                      required
                      className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm placeholder:text-slate-400 focus:outline-none focus:border-purple-600 focus:bg-white focus:ring-2 focus:ring-purple-500/15 transition"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      City <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-3 text-slate-400" size={16} />
                      <input
                        type="text"
                        name="city"
                        value={formData.city}
                        onChange={handleChange}
                        placeholder="e.g. Mumbai"
                        required
                        className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm placeholder:text-slate-400 focus:outline-none focus:border-purple-600 focus:bg-white focus:ring-2 focus:ring-purple-500/15 transition"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      State
                    </label>
                    <input
                      type="text"
                      name="state"
                      value={formData.state}
                      onChange={handleChange}
                      placeholder="e.g. Maharashtra"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm placeholder:text-slate-400 focus:outline-none focus:border-purple-600 focus:bg-white focus:ring-2 focus:ring-purple-500/15 transition"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Section 2: Social Media Presence */}
            <div>
              <div className="flex items-center gap-3 pb-3 mb-6 border-b border-slate-100">
                <div className="w-7 h-7 rounded-xl bg-pink-100 text-pink-700 flex items-center justify-center font-bold text-xs shadow-2xs">
                  2
                </div>
                <h3 className="font-bold text-base sm:text-lg text-slate-900 tracking-tight">
                  Instagram &amp; Audience Metrics
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Instagram Handle or Profile Link <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Instagram className="absolute left-3.5 top-3 text-pink-600" size={17} />
                    <input
                      type="text"
                      name="instagramHandle"
                      value={formData.instagramHandle}
                      onChange={handleChange}
                      placeholder="e.g. @priyasharma_official or instagram.com/priyasharma"
                      required
                      className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm placeholder:text-slate-400 focus:outline-none focus:border-pink-500 focus:bg-white focus:ring-2 focus:ring-pink-500/15 transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Follower Count Bracket
                  </label>
                  <select
                    name="followersCountBracket"
                    value={formData.followersCountBracket}
                    onChange={handleChange}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm focus:outline-none focus:border-purple-600 focus:bg-white focus:ring-2 focus:ring-purple-500/15 transition font-medium"
                  >
                    {FOLLOWER_TIERS.map(tier => (
                      <option key={tier} value={tier}>
                        {tier}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Primary Content Niche <span className="text-rose-500">*</span>
                  </label>
                  <select
                    name="category"
                    value={formData.category}
                    onChange={handleChange}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm focus:outline-none focus:border-purple-600 focus:bg-white focus:ring-2 focus:ring-purple-500/15 transition font-medium"
                  >
                    {NICHE_OPTIONS.map(opt => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>

                {formData.category === 'Other' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Specify Your Content Niche <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="otherCategory"
                      value={formData.otherCategory}
                      onChange={handleChange}
                      placeholder="e.g. Real Estate, Education, Pets, Art..."
                      className="w-full px-3.5 py-2.5 bg-purple-50/50 border border-purple-300 rounded-xl text-slate-800 text-sm placeholder:text-slate-400 focus:outline-none focus:border-purple-600 focus:bg-white focus:ring-2 focus:ring-purple-500/15 transition font-medium"
                    />
                  </div>
                )}

                <div className={formData.category === 'Other' ? 'sm:col-span-2' : ''}>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Languages You Create Content In
                  </label>
                  <input
                    type="text"
                    name="languages"
                    value={formData.languages}
                    onChange={handleChange}
                    placeholder="e.g. Hindi, English, Punjabi, Marathi"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm placeholder:text-slate-400 focus:outline-none focus:border-purple-600 focus:bg-white focus:ring-2 focus:ring-purple-500/15 transition"
                  />
                </div>
              </div>
            </div>

            {/* Section 3: Collaboration Preferences */}
            <div>
              <div className="flex items-center gap-3 pb-3 mb-6 border-b border-slate-100">
                <div className="w-7 h-7 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs shadow-2xs">
                  3
                </div>
                <h3 className="font-bold text-base sm:text-lg text-slate-900 tracking-tight">
                  Collaboration Preference
                </h3>
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-2.5">
                  What Type of Brand Deals Are You Interested In?
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    { id: 'Barter', label: 'Barter' },
                    { id: 'Paid', label: 'Paid' },
                    { id: 'Both', label: 'Both (Barter & Paid)' }
                  ].map(type => {
                    const isActive = formData.collabTypePreference === type.id;
                    return (
                      <button
                        type="button"
                        key={type.id}
                        onClick={() => setFormData(prev => ({ ...prev, collabTypePreference: type.id as any }))}
                        className={`py-3.5 px-4 rounded-xl border text-center font-semibold text-xs sm:text-sm transition-all flex items-center justify-center gap-2 cursor-pointer ${
                          isActive
                            ? 'bg-purple-50 border-purple-600 text-purple-900 shadow-xs ring-1 ring-purple-600 font-bold'
                            : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 hover:border-slate-300'
                        }`}
                      >
                        {isActive && <CheckCircle2 size={16} className="text-purple-600 shrink-0" />}
                        <span>{type.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Section 4: PR Package Delivery Address & Sizing */}
            <div>
              <div className="flex items-center gap-3 pb-3 mb-6 border-b border-slate-100">
                <div className="w-7 h-7 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center font-bold text-xs shadow-2xs">
                  4
                </div>
                <div>
                  <h3 className="font-bold text-base sm:text-lg text-slate-900 tracking-tight">
                    {formData.category === 'Fashion & Styling' ? 'PR Package Delivery Address & Sizing' : 'PR Package Delivery Address'}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Shipping destination for brand gifts &amp; PR kits
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Delivery Address (House / Flat No., Street, Area)
                  </label>
                  <div className="relative">
                    <Package className="absolute left-3.5 top-3 text-slate-400" size={17} />
                    <input
                      type="text"
                      name="addressLine"
                      value={formData.addressLine}
                      onChange={handleChange}
                      placeholder="e.g. Flat 402, Sunshine Heights, MG Road"
                      className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm placeholder:text-slate-400 focus:outline-none focus:border-purple-600 focus:bg-white focus:ring-2 focus:ring-purple-500/15 transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Pincode
                  </label>
                  <input
                    type="text"
                    name="pincode"
                    value={formData.pincode}
                    onChange={handleChange}
                    placeholder="e.g. 400001"
                    maxLength={6}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm placeholder:text-slate-400 focus:outline-none focus:border-purple-600 focus:bg-white focus:ring-2 focus:ring-purple-500/15 transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Landmark
                  </label>
                  <input
                    type="text"
                    name="landmark"
                    value={formData.landmark}
                    onChange={handleChange}
                    placeholder="e.g. Near City Mall"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm placeholder:text-slate-400 focus:outline-none focus:border-purple-600 focus:bg-white focus:ring-2 focus:ring-purple-500/15 transition"
                  />
                </div>

                {/* Sizing fields ONLY for Fashion & Styling */}
                {formData.category === 'Fashion & Styling' && (
                  <>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Apparel / Clothing Size (for fashion PR kits)
                      </label>
                      <select
                        name="clothingSize"
                        value={formData.clothingSize}
                        onChange={handleChange}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm focus:outline-none focus:border-purple-600 focus:bg-white focus:ring-2 focus:ring-purple-500/15 transition font-medium"
                      >
                        {CLOTHING_SIZES.map(s => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Footwear / Shoe Size (UK/India)
                      </label>
                      <input
                        type="text"
                        name="shoeSize"
                        value={formData.shoeSize}
                        onChange={handleChange}
                        placeholder="e.g. 6, 7, 8"
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm placeholder:text-slate-400 focus:outline-none focus:border-purple-600 focus:bg-white focus:ring-2 focus:ring-purple-500/15 transition"
                      />
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-3">
              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-purple-600 via-indigo-600 to-pink-500 hover:from-purple-700 hover:via-indigo-700 hover:to-pink-600 text-white font-bold text-sm sm:text-base flex items-center justify-center gap-2.5 shadow-xl shadow-purple-600/25 hover:shadow-purple-600/35 transition-all transform active:scale-[0.99] disabled:opacity-50 cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader2 size={19} className="animate-spin" /> Submitting Application...
                  </>
                ) : (
                  <>
                    Submit Creator Profile &amp; Receive Brand Deals <ArrowRight size={19} />
                  </>
                )}
              </button>
              <div className="flex items-center justify-center gap-2 text-xs text-slate-500 mt-4 text-center">
                <ShieldCheck size={16} className="text-emerald-600 shrink-0" />
                <span>Your information is strictly protected and shared only with verified collaborating brands.</span>
              </div>
            </div>
          </form>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200/80 bg-white/80 py-6 text-center text-xs text-slate-500">
        <p>&copy; {new Date().getFullYear()} Ad2ship Influencer Marketing Operations Hub. All rights reserved.</p>
      </footer>
    </div>
  );
};
