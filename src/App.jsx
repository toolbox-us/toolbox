import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Tab, TabList, TabPanel, Tabs } from 'react-tabs';
import 'react-tabs/style/react-tabs.css';
import Header from './components/layout/Header';
import TextEncoder from './components/base64/TextEncoder';
import ImageEncoder from './components/base64/ImageEncoder';
import PDFEncoder from './components/base64/PDFEncoder';
import MergePDF from './components/pdf/MergePDF';
import EditSignPDF from './components/pdf/EditSignPDF';
import ImageToPDF from './components/pdf/ImageToPDF';
import CompressPDF from './components/pdf/CompressPDF';
import RequestBuilder from './components/api-client/RequestBuilder';
import JsonXmlFormatter from './components/utilities/JsonXmlFormatter';
import UuidGenerator from './components/utilities/UuidGenerator';
import JwtDecoder from './components/utilities/JwtDecoder';
import QrGenerator from './components/utilities/QrGenerator';
import XMLJsonViewer from './components/utilities/XMLJsonViewer';
import TextCompare from './components/utilities/TextCompare';
import XMLJsonCompare from './components/utilities/XMLJsonCompare';
import EpochConverter from './components/utilities/EpochConverter';
import DiffChecker from './components/utilities/DiffChecker';

// ─── Flat search index ────────────────────────────────────────────
const SEARCH_INDEX = [
  { display: 'Base64 · Text',                    sectionIdx: 0, tabIdx: 0 },
  { display: 'Base64 · Images',                  sectionIdx: 0, tabIdx: 1 },
  { display: 'Base64 · PDFs',                    sectionIdx: 0, tabIdx: 2 },
  { display: 'PDF · Merge',                      sectionIdx: 1, tabIdx: 0 },
  { display: 'PDF · Edit and Sign',              sectionIdx: 1, tabIdx: 1 },
  { display: 'PDF · Image to PDF',               sectionIdx: 1, tabIdx: 2 },
  { display: 'PDF · Compress',                   sectionIdx: 1, tabIdx: 3 },
  { display: 'API Client',                       sectionIdx: 2, tabIdx: null },
  { display: 'Compare · Text Compare',           sectionIdx: 3, tabIdx: 0 },
  { display: 'Compare · Diff Checker',           sectionIdx: 3, tabIdx: 1 },
  { display: 'Compare · JSON & XML Formatter',   sectionIdx: 3, tabIdx: 2 },
  { display: 'Compare · XML & JSON Viewer',      sectionIdx: 3, tabIdx: 3 },
  { display: 'Compare · JSON & XML Compare',     sectionIdx: 3, tabIdx: 4 },
  { display: 'Utilities · UUID',                 sectionIdx: 4, tabIdx: 0 },
  { display: 'Utilities · JWT Decoder',          sectionIdx: 4, tabIdx: 1 },
  { display: 'Utilities · QR Generator',         sectionIdx: 4, tabIdx: 2 },
  { display: 'Utilities · Epoch Converter',      sectionIdx: 4, tabIdx: 3 },
];

// ─── SearchBar ────────────────────────────────────────────────────
function SearchBar({ onNavigate }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [focusedIdx, setFocusedIdx] = useState(0);
  const inputRef = useRef(null);

  const results = query.trim()
    ? SEARCH_INDEX.filter(item =>
        item.display.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 10)
    : [];

  const show = open && results.length > 0;

  const navigate = (item) => {
    onNavigate(item.sectionIdx, item.tabIdx);
    setQuery('');
    setOpen(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setFocusedIdx(i => Math.min(i + 1, results.length - 1)); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setFocusedIdx(i => Math.max(i - 1, 0)); }
    if (e.key === 'Enter' && results[focusedIdx]) { e.preventDefault(); navigate(results[focusedIdx]); }
    if (e.key === 'Escape')    { setOpen(false); setQuery(''); inputRef.current?.blur(); }
  };

  return (
    <div className="relative">
      <div className="relative">
        <svg className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z" clipRule="evenodd" />
        </svg>
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); setFocusedIdx(0); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={handleKeyDown}
          placeholder="Search tools…"
          aria-label="Search tools"
          aria-expanded={show}
          aria-autocomplete="list"
          className="input w-44 pl-8 text-sm sm:w-60"
        />
      </div>

      {show && (
        <ul
          role="listbox"
          className="absolute right-0 top-full z-[9999] mt-1 w-72 overflow-hidden rounded-lg border border-slate-700 bg-slate-900 shadow-2xl"
        >
          {results.map((item, i) => {
            const parts = item.display.split(' · ');
            return (
              <li key={item.display} role="option" aria-selected={i === focusedIdx}>
                <button
                  type="button"
                  className={`w-full px-3 py-2 text-left text-sm transition ${i === focusedIdx ? 'bg-blue-600 text-white' : 'text-slate-200 hover:bg-slate-800'}`}
                  onMouseEnter={() => setFocusedIdx(i)}
                  onMouseDown={(e) => { e.preventDefault(); navigate(item); }}
                >
                  {parts.length > 1 ? (
                    <>
                      <span className={`text-xs ${i === focusedIdx ? 'text-blue-200' : 'text-slate-400'}`}>{parts[0]} · </span>
                      <span className="font-medium">{parts[1]}</span>
                    </>
                  ) : (
                    <span className="font-medium">{item.display}</span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function TabLabel({ title }) {
  return (
    <div className="text-left">
      <span className="text-sm font-semibold leading-none text-ij-text">{title}</span>
    </div>
  );
}

function MainSectionMenu({ sections, selectedIndex, onSelect }) {
  const [isPaneOpen, setIsPaneOpen] = useState(false);
  const triggerRef = useRef(null);
  const itemRefs = useRef([]);
  const selectedSection = sections[selectedIndex] ?? sections[0];
  const buttonId = 'main-tool-family-trigger';
  const panelId = 'main-tool-family-pane';

  const closePane = (shouldRestoreFocus = false) => {
    setIsPaneOpen(false);
    if (shouldRestoreFocus) requestAnimationFrame(() => triggerRef.current?.focus());
  };

  const focusMenuItem = (index) => {
    const count = sections.length;
    if (!count) return;
    const next = ((index % count) + count) % count;
    itemRefs.current[next]?.focus();
  };

  useEffect(() => {
    const handleEscape = (event) => { if (event.key === 'Escape' && isPaneOpen) closePane(true); };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isPaneOpen]);

  useEffect(() => {
    document.body.style.overflow = isPaneOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isPaneOpen]);

  useEffect(() => {
    if (!isPaneOpen) return;
    const firstTarget = itemRefs.current[selectedIndex] || itemRefs.current[0];
    firstTarget?.focus();
  }, [isPaneOpen, selectedIndex]);

  const onMenuSelect = (index) => { onSelect(index); closePane(true); };

  const handleTriggerKeyDown = (event) => {
    if (event.key === 'ArrowDown') { event.preventDefault(); setIsPaneOpen(true); requestAnimationFrame(() => focusMenuItem(selectedIndex || 0)); }
    if (event.key === 'ArrowUp')   { event.preventDefault(); setIsPaneOpen(true); requestAnimationFrame(() => focusMenuItem((selectedIndex || 0) - 1)); }
  };

  const handleMenuKeyDown = (event, index) => {
    if (event.key === 'ArrowDown') { event.preventDefault(); focusMenuItem(index + 1); return; }
    if (event.key === 'ArrowUp')   { event.preventDefault(); focusMenuItem(index - 1); return; }
    if (event.key === 'Home')      { event.preventDefault(); focusMenuItem(0); return; }
    if (event.key === 'End')       { event.preventDefault(); focusMenuItem(sections.length - 1); return; }
    if (event.key === 'Escape')    { event.preventDefault(); closePane(true); }
  };

  return (
    <>
      <button
        id={buttonId} ref={triggerRef} type="button"
        className={['inline-flex h-11 w-11 items-center justify-center rounded-xl border text-white transition duration-200', 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40', isPaneOpen ? 'border-brand-500 bg-ij-panel' : 'border-ij-border bg-ij-elevated hover:bg-ij-hover'].join(' ')}
        onClick={() => setIsPaneOpen(open => !open)}
        onKeyDown={handleTriggerKeyDown}
        aria-expanded={isPaneOpen} aria-haspopup="dialog"
        aria-label={`Open tools menu. Current section: ${selectedSection.title}`}
        aria-controls={panelId} title="Open tool sections"
      >
        <span className="relative h-4 w-5" aria-hidden="true">
          <span className={['absolute left-0 top-0 h-0.5 w-5 rounded-full bg-current transition duration-200', isPaneOpen ? 'translate-y-[7px] rotate-45' : ''].join(' ')} />
          <span className={['absolute left-0 top-[7px] h-0.5 w-5 rounded-full bg-current transition duration-200', isPaneOpen ? 'opacity-0' : 'opacity-100'].join(' ')} />
          <span className={['absolute left-0 top-[14px] h-0.5 w-5 rounded-full bg-current transition duration-200', isPaneOpen ? '-translate-y-[7px] -rotate-45' : ''].join(' ')} />
        </span>
      </button>

      {isPaneOpen && typeof document !== 'undefined' ? createPortal(
        <div className="fixed inset-0 z-[9999]" aria-hidden={!isPaneOpen}>
          <button type="button" className="absolute inset-0 bg-ij-bg/80" onClick={() => closePane(true)} aria-label="Close tools menu" />
          <aside id={panelId} role="dialog" aria-modal="true" aria-labelledby={`${panelId}-title`}
            className="absolute inset-y-0 left-0 z-10 flex w-full max-w-[300px] flex-col border-r bg-ij-popup shadow-2xl shadow-black/40"
            style={{ borderColor: '#4E5254' }}
          >
            <div className="flex items-center justify-between gap-2 border-b px-4 py-4" style={{ borderColor: '#4E5254' }}>
              <div>
                <p id={`${panelId}-title`} className="text-xs font-semibold uppercase tracking-[0.18em] text-ij-muted">Navigation</p>
                <p className="mt-1 text-sm text-ij-text">All tool sections</p>
              </div>
              <button type="button" className="btn-secondary !h-9 !w-9 !p-0" onClick={() => closePane(true)} aria-label="Close menu">✕</button>
            </div>
            <div className="overflow-y-auto px-3 py-3" role="menu" aria-label="Tool sections">
              {sections.map((section, index) => {
                const isSelected = index === selectedIndex;
                return (
                  <button
                    key={section.title} type="button"
                    ref={el => { itemRefs.current[index] = el; }}
                    onClick={() => onMenuSelect(index)}
                    onKeyDown={event => handleMenuKeyDown(event, index)}
                    className={['mb-1 flex w-full items-start justify-between gap-3 rounded-lg px-3 py-2.5 text-left transition', 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40', isSelected ? 'border-l-2 border-l-brand-400 bg-ij-hover text-ij-text' : 'border-l-2 border-l-transparent text-ij-muted hover:bg-ij-hover hover:text-ij-text'].join(' ')}
                    role="menuitemradio" aria-checked={isSelected} aria-current={isSelected ? 'true' : undefined}
                    aria-label={`Switch to ${section.title}`}
                  >
                    <span className="min-w-0">
                      <span className="block text-sm font-medium leading-none">{section.title}</span>
                      <span className="mt-1 block text-xs text-ij-dim">{section.subtitle}</span>
                    </span>
                    {isSelected ? <span className="text-xs text-brand-300">Active</span> : null}
                  </button>
                );
              })}
            </div>
            <div className="mt-auto border-t px-4 py-3 text-xs text-ij-dim" style={{ borderColor: '#4E5254' }}>
              Select a section to close menu and focus the tool screen.
            </div>
          </aside>
        </div>,
        document.body
      ) : null}
    </>
  );
}

function SectionTabs({ eyebrow, title, description, tabs, selectedTabIndex = 0, onTabSelect }) {
  return (
    <div className="section-shell panel-elevated space-y-5">
      <div className="flex flex-col gap-2">
        <p className="section-kicker">{eyebrow}</p>
        <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-ij-text">{title}</h2>
            <p className="mt-2 max-w-3xl text-sm text-ij-muted">{description}</p>
          </div>
          <div className="badge">{tabs.length} tools</div>
        </div>
      </div>
      <Tabs className="react-tabs react-tabs--rich" selectedIndex={selectedTabIndex} onSelect={onTabSelect}>
        <TabList>
          {tabs.map(tab => <Tab key={tab.title}><TabLabel title={tab.title} /></Tab>)}
        </TabList>
        {tabs.map(tab => (
          <TabPanel key={tab.title}>
            <div className="panel">{tab.content}</div>
          </TabPanel>
        ))}
      </Tabs>
    </div>
  );
}

function Base64Section({ selectedTabIndex, onTabSelect }) {
  const tabs = [
    { title: 'Text',   content: <TextEncoder /> },
    { title: 'Images', content: <ImageEncoder /> },
    { title: 'PDFs',   content: <PDFEncoder /> },
  ];
  return <SectionTabs eyebrow="Encoding suite" title="Base64 tools" description="Encode or decode text, images, and PDF files with visual previews and browser-only processing." tabs={tabs} selectedTabIndex={selectedTabIndex} onTabSelect={onTabSelect} />;
}

function PdfSection({ selectedTabIndex, onTabSelect }) {
  const tabs = [
    { title: 'Merge',        content: <MergePDF /> },
    { title: 'Edit and Sign', content: <EditSignPDF /> },
    { title: 'Image to PDF', content: <ImageToPDF /> },
    { title: 'Compress PDF', content: <CompressPDF /> },
  ];
  return <SectionTabs eyebrow="Document workspace" title="PDF utilities" description="Merge, edit, sign, convert, and compress PDFs with drag-and-drop flows and quick browser previews." tabs={tabs} selectedTabIndex={selectedTabIndex} onTabSelect={onTabSelect} />;
}

function CompareDiffSection({ selectedTabIndex, onTabSelect }) {
  const tabs = [
    { title: 'Text Compare',        content: <TextCompare /> },
    { title: 'Diff Checker',        content: <DiffChecker /> },
    { title: 'JSON & XML Formatter', content: <JsonXmlFormatter /> },
    { title: 'XML & JSON Viewer',   content: <XMLJsonViewer /> },
    { title: 'JSON & XML Compare',  content: <XMLJsonCompare /> },
  ];
  return <SectionTabs eyebrow="Diff and formatting" title="Compare & inspect" description="Compare text, review diffs, and format JSON or XML payloads without switching between tools." tabs={tabs} selectedTabIndex={selectedTabIndex} onTabSelect={onTabSelect} />;
}

function UtilitiesSection({ selectedTabIndex, onTabSelect }) {
  const tabs = [
    { title: 'UUID',            content: <UuidGenerator /> },
    { title: 'JWT Decoder',     content: <JwtDecoder /> },
    { title: 'QR Generator',    content: <QrGenerator /> },
    { title: 'Epoch Converter', content: <EpochConverter /> },
  ];
  return <SectionTabs eyebrow="Everyday helpers" title="Developer utilities" description="Generate IDs, decode tokens, create QR codes, and convert timestamps with polished, single-purpose tools." tabs={tabs} selectedTabIndex={selectedTabIndex} onTabSelect={onTabSelect} />;
}

const APP_SECTIONS = [
  { title: 'Base64',        subtitle: 'Text, images, and PDF encoding' },
  { title: 'PDF Utilities', subtitle: 'Merge, sign, and transform documents' },
  { title: 'API Client',    subtitle: 'Build requests and inspect responses' },
  { title: 'Compare & Diff', subtitle: 'Validate content side by side' },
  { title: 'Utilities',     subtitle: 'Quick helpers for daily development' },
];

export default function App() {
  const [selectedSectionIndex, setSelectedSectionIndex] = useState(0);
  const [selectedTabIndices, setSelectedTabIndices] = useState({ 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 });

  const setTabIndex = (sectionIdx, tabIdx) =>
    setSelectedTabIndices(prev => ({ ...prev, [sectionIdx]: tabIdx }));

  const handleNavigate = (sectionIdx, tabIdx) => {
    setSelectedSectionIndex(sectionIdx);
    if (tabIdx !== null) setTabIndex(sectionIdx, tabIdx);
  };

  return (
    <main className="w-full px-4 py-6 sm:px-6 lg:px-8">
      <Header
        navigation={
          <MainSectionMenu
            sections={APP_SECTIONS}
            selectedIndex={selectedSectionIndex}
            onSelect={setSelectedSectionIndex}
          />
        }
        search={<SearchBar onNavigate={handleNavigate} />}
      />

      <div className="min-w-0">
        <Tabs className="react-tabs app-tabs" selectedIndex={selectedSectionIndex} onSelect={setSelectedSectionIndex}>
          <TabList className="hidden">
            {APP_SECTIONS.map(s => <Tab key={s.title}><TabLabel title={s.title} /></Tab>)}
          </TabList>
          <TabPanel key="Base64">
            <Base64Section selectedTabIndex={selectedTabIndices[0]} onTabSelect={i => setTabIndex(0, i)} />
          </TabPanel>
          <TabPanel key="PDF">
            <PdfSection selectedTabIndex={selectedTabIndices[1]} onTabSelect={i => setTabIndex(1, i)} />
          </TabPanel>
          <TabPanel key="API">
            <RequestBuilder />
          </TabPanel>
          <TabPanel key="Compare">
            <CompareDiffSection selectedTabIndex={selectedTabIndices[3]} onTabSelect={i => setTabIndex(3, i)} />
          </TabPanel>
          <TabPanel key="Utilities">
            <UtilitiesSection selectedTabIndex={selectedTabIndices[4]} onTabSelect={i => setTabIndex(4, i)} />
          </TabPanel>
        </Tabs>
      </div>
    </main>
  );
}
