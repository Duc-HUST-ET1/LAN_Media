import { useEffect, useMemo, useRef, useState } from "react";
import type { AuthUser } from "../api/AuthApi";
import { ChatApi, type Conversation } from "../api/ChatApi";
import { FileApi } from "../api/FileApi";
import { realtimeClient, type RealtimeEvent } from "../api/RealtimeClient";
import ChatPage from "./ChatPage/ChatPage";
import type { CallController } from "../hooks/useCall";

type IconName =
  | "bell"
  | "call"
  | "camera"
  | "check"
  | "chevron"
  | "cloud"
  | "dots"
  | "download"
  | "file"
  | "folder"
  | "grid"
  | "image"
  | "list"
  | "message"
  | "mic"
  | "missed"
  | "paperclip"
  | "phone-in"
  | "phone-out"
  | "plus"
  | "search"
  | "send"
  | "settings"
  | "shield"
  | "trash"
  | "upload"
  | "user"
  | "users"
  | "video-off"
  | "wifi"
  | "x";

const paths: Record<IconName, React.ReactNode> = {
  bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></>,
  call: <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.9a2 2 0 0 1-.4 2.1L8.1 10a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c1 .3 1.9.6 2.9.7a2 2 0 0 1 1.6 1.9z"/>,
  camera: <><path d="m16 13 5 3V8l-5 3"/><rect x="3" y="6" width="13" height="12" rx="2"/></>,
  check: <path d="M20 6 9 17l-5-5"/>,
  chevron: <path d="m9 18 6-6-6-6"/>,
  cloud: <path d="M18 10h-1.3A6 6 0 1 0 8 17h10a4 4 0 0 0 0-8z"/>,
  dots: <><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></>,
  download: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></>,
  file: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></>,
  folder: <path d="M3 5a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>,
  grid: <><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></>,
  image: <><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></>,
  list: <><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></>,
  message: <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/>,
  mic: <><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0M12 17v5"/></>,
  missed: <><path d="m10 14-2 2-4-4"/><path d="m8 16 2-2 3.5 3.5"/><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1"/></>,
  paperclip: <path d="m21.4 11.6-8.5 8.5a6 6 0 0 1-8.5-8.5l9.2-9.2a4 4 0 0 1 5.7 5.7l-9.2 9.2a2 2 0 1 1-2.8-2.8l8.5-8.5"/>,
  "phone-in": <><polyline points="16 2 16 8 22 8"/><line x1="22" y1="2" x2="16" y2="8"/><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.9a2 2 0 0 1-.4 2.1L8.1 10a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c1 .3 1.9.6 2.9.7a2 2 0 0 1 1.6 1.9z"/></>,
  "phone-out": <><polyline points="22 8 16 8 16 2"/><line x1="16" y1="8" x2="22" y2="2"/><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.9a2 2 0 0 1-.4 2.1L8.1 10a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c1 .3 1.9.6 2.9.7a2 2 0 0 1 1.6 1.9z"/></>,
  plus: <path d="M12 5v14M5 12h14"/>,
  search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
  send: <><path d="m22 2-7 20-4-9-9-4z"/><path d="M22 2 11 13"/></>,
  settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.6v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1z"/></>,
  shield: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>,
  trash: <><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></>,
  upload: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></>,
  user: <><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></>,
  users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/></>,
  "video-off": <><path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2m5.66 0H14a2 2 0 0 1 2 2v3.34"/><path d="m22 22-6-6M22 2l-6 6 6 6"/></>,
  wifi: <><path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><circle cx="12" cy="20" r="1"/></>,
  x: <path d="M18 6 6 18M6 6l12 12"/>,
};

function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}

// ─── Data ───────────────────────────────────────────────────────────────────

type CallLog = {
  id: string;
  name: string;
  initials: string;
  color: string;
  type: "in" | "out" | "missed" | "video";
  duration: string;
  time: string;
  date: string;
};

const callLogs: CallLog[] = [];

type CloudFile = {
  id: string;
  name: string;
  size: string;
  uploader: string;
  date: string;
  type: string;
  category: "all" | "docs" | "media" | "design";
};

type Contact = {
  id: string;
  name: string;
  initials: string;
  color: string;
  role: string;
  ip: string;
  online: boolean;
  device: string;
};

const palette = ["blue", "violet", "teal", "rose", "amber"] as const;
function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) { value /= 1024; unit += 1; }
  return `${value.toFixed(value >= 10 ? 1 : 2)} ${units[unit]}`;
}

// ─── App ─────────────────────────────────────────────────────────────────────

type TabId = "message" | "users" | "files" | "calls" | "settings";

export default function DemoWorkspace({ user, call, initialTab = "calls", onOpenChat, onLogout }: { user: AuthUser; call: CallController; initialTab?: TabId; onOpenChat: () => void; onLogout: () => void }) {
  const [activeTab, setActiveTab] = useState<TabId>(initialTab);
  const [people, setPeople] = useState<AuthUser[]>([]);
  const [onlineIds, setOnlineIds] = useState<Set<string>>(new Set());
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [cloudFiles, setCloudFiles] = useState<CloudFile[]>([]);
  const [dataError, setDataError] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const [notice, setNotice] = useState("");
  const [fileFilter, setFileFilter] = useState<"all" | "docs" | "media" | "design">("all");
  const [fileView, setFileView] = useState<"grid" | "list">("list");
  const [callFilter, setCallFilter] = useState<"all" | "missed">("all");
  const [settingsSection, setSettingsSection] = useState<"profile" | "network" | "notifications" | "security" | "appearance">("profile");
  const [notifChat, setNotifChat] = useState(true);
  const [notifCall, setNotifCall] = useState(true);
  const [notifFile, setNotifFile] = useState(false);
  const [notifSound, setNotifSound] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const [compactMode, setCompactMode] = useState(false);
  const [contactQuery, setContactQuery] = useState("");

  useEffect(() => { setActiveTab(initialTab); }, [initialTab]);

  useEffect(() => {
    let current = true;
    async function loadWorkspaceData() {
      try {
        const [users, online, chats] = await Promise.all([ChatApi.contacts(), ChatApi.online(), ChatApi.conversations()]);
        const filesByConversation = await Promise.all(chats.map(conversation => ChatApi.files(conversation.id).catch(() => [])));
        if (!current) return;
        setPeople(users);
        setOnlineIds(new Set(online.map(person => person.id)));
        setConversations(chats);
        const files = filesByConversation.flat().map(file => {
          const extension = file.name.split(".").pop()?.toLowerCase() ?? "file";
          const category = /\.(fig|sketch|xd|psd)$/i.test(file.name) ? "design" : /\.(png|jpe?g|gif|mp4|mov|webm)$/i.test(file.name) ? "media" : "docs";
          return { id: file.id, name: file.name, size: formatBytes(file.size), uploader: file.senderName, date: new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium" }).format(new Date(file.createdAt)), type: extension, category } satisfies CloudFile;
        });
        setCloudFiles(files);
        setDataError("");
      } catch (cause) {
        if (current) setDataError(cause instanceof Error ? cause.message : "Không thể tải dữ liệu workspace.");
      }
    }
    void loadWorkspaceData();
    return () => { current = false; };
  }, []);

  useEffect(() => realtimeClient.subscribe((event: RealtimeEvent) => {
    if ((event.type === "presence.online" || event.type === "presence.offline") && typeof event.payload?.userId === "string") {
      const userId = event.payload.userId;
      setOnlineIds(current => {
        const next = new Set(current);
        if (event.type === "presence.online") next.add(userId);
        else next.delete(userId);
        return next;
      });
    }
    if (event.type === "chat.message" && (event.payload?.message as { type?: string } | undefined)?.type === "FILE") {
      void ChatApi.conversations().then(async chats => {
        const byChat = await Promise.all(chats.map(conversation => ChatApi.files(conversation.id).catch(() => [])));
        setConversations(chats);
        setCloudFiles(byChat.flat().map(file => {
          const extension = file.name.split(".").pop()?.toLowerCase() ?? "file";
          const category = /\.(fig|sketch|xd|psd)$/i.test(file.name) ? "design" : /\.(png|jpe?g|gif|mp4|mov|webm)$/i.test(file.name) ? "media" : "docs";
          return { id: file.id, name: file.name, size: formatBytes(file.size), uploader: file.senderName, date: new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium" }).format(new Date(file.createdAt)), type: extension, category } satisfies CloudFile;
        }));
      }).catch(() => undefined);
    }
  }), []);

  const contacts = useMemo<Contact[]>(() => people.map((person, index) => ({
    id: person.id,
    name: person.displayName,
    initials: person.displayName.split(/\s+/).slice(-2).map(part => part[0]).join("").toUpperCase(),
    color: palette[index % palette.length],
    role: person.role === "ADMIN" ? "Quản trị viên" : "Thành viên",
    ip: "",
    online: onlineIds.has(person.id),
    device: "",
  })), [people, onlineIds]);

  const filteredContacts = useMemo(
    () => contacts.filter((c) => c.name.toLowerCase().includes(contactQuery.toLowerCase())),
    [contactQuery],
  );
  const filteredFiles = useMemo(
    () => (fileFilter === "all" ? cloudFiles : cloudFiles.filter((f) => f.category === fileFilter)),
    [fileFilter],
  );
  const filteredCalls = useMemo(
    () => (callFilter === "all" ? callLogs : callLogs.filter((c) => c.type === "missed")),
    [callFilter],
  );
  function showNotice(text: string) {
    setNotice(text);
    window.setTimeout(() => setNotice(""), 2600);
  }

  async function uploadCloudFile(file?: File) {
    const conversationId = conversations[0]?.id;
    if (!file) return;
    if (!conversationId) { showNotice("Hãy mở cuộc trò chuyện trước khi tải tệp lên."); return; }
    try {
      await FileApi.upload(conversationId, file, () => undefined);
      const allFiles = await Promise.all(conversations.map(conversation => ChatApi.files(conversation.id).catch(() => [])));
      setCloudFiles(allFiles.flat().map(item => {
        const extension = item.name.split(".").pop()?.toLowerCase() ?? "file";
        const category = /\.(fig|sketch|xd|psd)$/i.test(item.name) ? "design" : /\.(png|jpe?g|gif|mp4|mov|webm)$/i.test(item.name) ? "media" : "docs";
        return { id: item.id, name: item.name, size: formatBytes(item.size), uploader: item.senderName, date: new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium" }).format(new Date(item.createdAt)), type: extension, category } satisfies CloudFile;
      }));
      showNotice("Đã tải tệp lên cuộc trò chuyện.");
    } catch (cause) { showNotice(cause instanceof Error ? cause.message : "Không thể tải tệp lên."); }
  }

  async function downloadCloudFile(fileId: string, name: string) {
    try { await FileApi.download(fileId, name, () => undefined); }
    catch (cause) { showNotice(cause instanceof Error ? cause.message : "Không thể tải tệp xuống."); }
  }

  async function startCall(contact: Contact, type: "voice" | "video") {
    if (!contact.online) return;
    try {
      await ChatApi.direct(contact.id);
      await call.start(contact.id, contact.name, type);
    } catch (cause) { showNotice(cause instanceof Error ? cause.message : "Không thể bắt đầu cuộc gọi."); }
  }

  const navItems: { id: TabId; icon: IconName; label: string }[] = [
    { id: "message", icon: "message", label: "Tin nhắn" },
    { id: "users", icon: "users", label: "Danh bạ" },
    { id: "files", icon: "folder", label: "LAN Cloud" },
    { id: "calls", icon: "call", label: "Cuộc gọi" },
  ];

  return (
    <main className={`demo-app-shell${activeTab === "message" ? " demo-app-shell--chat app-shell--chat" : ""}`}>
      {(notice || dataError) && <div className="toast" role={dataError ? "alert" : "status"}>{notice || dataError}</div>}

      {/* Rail */}
      <aside className="rail">
        <div className="brand-mark" aria-label="LAN Media">L</div>
        <nav className="rail-nav" aria-label="Điều hướng chính">
          {navItems.map((item) => (
            <button
              key={item.id}
              className={`rail-button ${activeTab === item.id ? "active" : ""}`}
              title={item.label}
              onClick={() => {
                if (item.id === "message") {
                  setActiveTab("message");
                  onOpenChat();
                } else setActiveTab(item.id);
              }}
            >
              <Icon name={item.icon} />
            </button>
          ))}
        </nav>
        <div className="rail-bottom">
          <button
            className={`rail-button ${activeTab === "settings" ? "active" : ""}`}
            title="Cài đặt"
            onClick={() => setActiveTab("settings")}
          >
            <Icon name="settings" />
          </button>
          <button className="avatar avatar-me" title={user.displayName} onClick={onLogout}>{user.displayName.slice(0, 1).toUpperCase()}<span className="presence-dot" /></button>
        </div>
      </aside>

      {/* ── Message Tab ──────────────────────────────────────────────────── */}
      {activeTab === "message" && <div className="live-chat-area"><ChatPage userId={user.id} call={call} /></div>}
      

      {/* ── Contacts Tab ─────────────────────────────────────────────────── */}
      {activeTab === "users" && (
        <section className="full-panel">
          <div className="full-sidebar">
            <header className="panel-heading">
              <div>
                <p className="eyebrow">LAN WORKSPACE</p>
                <h1>Danh bạ</h1>
              </div>
              <button className="square-button primary" title="Thêm liên hệ"><Icon name="plus" size={19} /></button>
            </header>
            <label className="search-box" style={{ margin: "0 22px 14px" }}>
              <Icon name="search" size={18} />
              <input value={contactQuery} onChange={(e) => setContactQuery(e.target.value)} placeholder="Tìm thành viên..." />
            </label>
            <div className="contact-stats">
              <div className="stat-chip online"><span className="stat-dot" />{contacts.length} thành viên</div>
              <div className="stat-chip"><span className="stat-dot offline" />{contacts.length - contacts.filter(c => c.online).length} ngoại tuyến</div>
            </div>
            <div className="contact-list">
              {filteredContacts.map((c) => (
                <div key={c.id} className="contact-row">
                  <span className={`avatar avatar-${c.color}`}>{c.initials}<span className={c.online ? "presence-dot" : "presence-dot offline"} /></span>
                  <div className="contact-info">
                    <strong>{c.name}</strong>
                    <span>{c.role}</span>
                  </div>
                  <div className="contact-actions">
                    <button className="icon-button" onClick={async () => { try { await ChatApi.direct(c.id); onOpenChat(); } catch (cause) { showNotice(cause instanceof Error ? cause.message : "Không thể mở cuộc trò chuyện."); } }} title="Nhắn tin"><Icon name="message" size={17} /></button>
                    <button className="icon-button" onClick={() => void startCall(c, "voice")} title="Gọi thoại" disabled={!c.online}><Icon name="call" size={17} /></button>
                  </div>
                </div>
              ))}
              {filteredContacts.length === 0 && <p className="empty-state">Không tìm thấy thành viên.</p>}
            </div>
          </div>

          <div className="full-main contacts-main">
            <div className="contacts-hero">
              <div className="contacts-hero-icon"><Icon name="wifi" size={28} /></div>
              <h2>Mạng nội bộ LAN</h2>
              <p>{contacts.filter(c => c.online).length} thành viên đang trực tuyến trong workspace này</p>
            </div>

            <div className="contacts-grid">
              {contacts.map((c) => (
                <div key={c.id} className="contact-card">
                  <div className="contact-card-top">
                    <span className={`avatar avatar-${c.color} contact-card-avatar`}>{c.initials}<span className={c.online ? "presence-dot" : "presence-dot offline"} /></span>
                    <span className={`status-badge ${c.online ? "online" : ""}`}>{c.online ? "Online" : "Offline"}</span>
                  </div>
                  <strong>{c.name}</strong>
                  <span className="contact-role">{c.role}</span>
                  <div className="contact-meta">
                    <span><Icon name="wifi" size={11} />@{people.find(person => person.id === c.id)?.username}</span>
                    <span>{c.role}</span>
                  </div>
                  <div className="contact-card-actions">
                    <button onClick={async () => { try { await ChatApi.direct(c.id); onOpenChat(); } catch (cause) { showNotice(cause instanceof Error ? cause.message : "Không thể mở cuộc trò chuyện."); } }}><Icon name="message" size={15} />Nhắn tin</button>
                    <button disabled={!c.online} onClick={() => void startCall(c, "voice")}><Icon name="call" size={15} />Gọi</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Files Tab ────────────────────────────────────────────────────── */}
      {activeTab === "files" && (
        <section className="full-panel">
          <div className="full-sidebar files-sidebar">
            <header className="panel-heading">
              <div>
                <p className="eyebrow">LAN WORKSPACE</p>
                <h1>LAN Cloud</h1>
              </div>
              <button className="square-button primary" onClick={() => fileInput.current?.click()} title="Tải lên"><Icon name="upload" size={19} /></button>
              <input ref={fileInput} type="file" hidden onChange={event => { void uploadCloudFile(event.currentTarget.files?.[0]); event.currentTarget.value = ""; }} />
            </header>
            <div className="files-storage">
              <div className="storage-bar-wrap">
                  <div className="storage-label"><Icon name="cloud" size={14} /><span>Tệp trong các cuộc trò chuyện</span><strong>{cloudFiles.length} tệp</strong></div>
                <div className="storage-bar"><div className="storage-fill" style={{ width: "0%" }} /></div>
              </div>
            </div>
            <nav className="files-nav">
              {(["all", "docs", "media", "design"] as const).map((cat) => {
                const labels = { all: "Tất cả tệp", docs: "Tài liệu", media: "Phương tiện", design: "Thiết kế" };
                const icons: Record<string, IconName> = { all: "folder", docs: "file", media: "camera", design: "image" };
                return (
                  <button key={cat} className={`files-nav-item ${fileFilter === cat ? "active" : ""}`} onClick={() => setFileFilter(cat)}>
                    <Icon name={icons[cat]} size={17} />
                    <span>{labels[cat]}</span>
                  </button>
                );
              })}
            </nav>
            <div className="files-recent-users">
              <p className="eyebrow" style={{ padding: "0 20px", marginBottom: 10 }}>THÀNH VIÊN CHIA SẺ</p>
              {contacts.slice(0, 4).map((c) => (
                <div key={c.id} className="files-user-row">
                  <span className={`avatar avatar-${c.color} small`}>{c.initials}</span>
                  <span className="files-user-name">{c.name}</span>
                  <span className="files-user-count">{cloudFiles.filter((f) => f.uploader === c.name).length} tệp</span>
                </div>
              ))}
            </div>
          </div>

          <div className="full-main">
            <div className="files-toolbar">
              <div>
                <h2 className="files-main-title">
                  {{ all: "Tất cả tệp", docs: "Tài liệu", media: "Phương tiện", design: "Thiết kế" }[fileFilter]}
                </h2>
                <span className="files-count">{filteredFiles.length} tệp</span>
              </div>
              <div className="files-toolbar-right">
                <button className={`view-toggle ${fileView === "list" ? "active" : ""}`} onClick={() => setFileView("list")} title="Danh sách"><Icon name="list" size={17} /></button>
                <button className={`view-toggle ${fileView === "grid" ? "active" : ""}`} onClick={() => setFileView("grid")} title="Lưới"><Icon name="grid" size={17} /></button>
              </div>
            </div>

            {fileView === "list" ? (
              <div className="files-list-view">
                <div className="files-list-header">
                  <span>Tên tệp</span>
                  <span>Kích thước</span>
                  <span>Người dùng</span>
                  <span>Ngày</span>
                  <span></span>
                </div>
                {filteredFiles.map((f) => (
                  <div key={f.id} className="files-list-row">
                    <span className="files-list-name">
                      <span className={`file-icon ${f.type} small`}>{f.type.toUpperCase().slice(0, 2)}</span>
                      <strong>{f.name}</strong>
                    </span>
                    <span className="files-meta-cell">{f.size}</span>
                    <span className="files-meta-cell">{f.uploader}</span>
                    <span className="files-meta-cell">{f.date}</span>
                    <span className="files-actions-cell">
                      <button className="icon-button" onClick={() => void downloadCloudFile(f.id, f.name)} title="Tải xuống"><Icon name="download" size={16} /></button>
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="files-grid-view">
                {filteredFiles.map((f) => (
                  <div key={f.id} className="file-card">
                    <div className="file-card-icon">
                      <span className={`file-icon ${f.type} large`}>{f.type.toUpperCase().slice(0, 2)}</span>
                    </div>
                    <strong>{f.name}</strong>
                    <span>{f.size} · {f.date}</span>
                    <div className="file-card-actions">
                      <button onClick={() => void downloadCloudFile(f.id, f.name)} title="Tải xuống"><Icon name="download" size={15} /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── Calls Tab ────────────────────────────────────────────────────── */}
      {activeTab === "calls" && (
        <section className="full-panel">
          <div className="full-sidebar">
            <header className="panel-heading">
              <div>
                <p className="eyebrow">LAN WORKSPACE</p>
                <h1>Cuộc gọi</h1>
              </div>
              <button className="square-button primary" onClick={() => showNotice("Đang bắt đầu cuộc gọi mới...")} title="Cuộc gọi mới"><Icon name="plus" size={19} /></button>
            </header>
            <div className="filter-row">
              <button className={`filter ${callFilter === "all" ? "active" : ""}`} onClick={() => setCallFilter("all")}>Tất cả</button>
              <button className={`filter ${callFilter === "missed" ? "active" : ""}`} onClick={() => setCallFilter("missed")}>Nhỡ <span>{callLogs.filter((c) => c.type === "missed").length}</span></button>
            </div>
            <div className="call-list">
              {!filteredCalls.length && <p className="empty-state">Chưa có API lưu lịch sử cuộc gọi.</p>}
              {filteredCalls.map((c) => (
                <div key={c.id} className="call-row">
                  <span className={`avatar avatar-${c.color}`}>{c.initials}</span>
                  <div className="call-info">
                    <strong>{c.name}</strong>
                    <span className={`call-type ${c.type}`}>
                      {c.type === "in" && <><Icon name="phone-in" size={11} />Cuộc gọi đến</>}
                      {c.type === "out" && <><Icon name="phone-out" size={11} />Cuộc gọi đi</>}
                      {c.type === "missed" && <><Icon name="x" size={11} />Cuộc gọi nhỡ</>}
                      {c.type === "video" && <><Icon name="camera" size={11} />Gọi video</>}
                    </span>
                  </div>
                  <div className="call-time-col">
                    <span>{c.time}</span>
                    <span className="call-date">{c.date}</span>
                  </div>
                  <button className="icon-button call-back-btn" onClick={() => showNotice(`Đang gọi lại ${c.name}...`)} title="Gọi lại">
                    <Icon name={c.type === "video" ? "camera" : "call"} size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="full-main calls-main">
            <div className="calls-stats-row">
              <div className="calls-stat"><span className="calls-stat-value">—</span><span>Chưa có API lịch sử cuộc gọi</span></div>
              <div className="calls-stat"><span className="calls-stat-value">{contacts.filter(c => c.online).length}</span><span>Thành viên có thể gọi</span></div>
              <div className="calls-stat missed"><span className="calls-stat-value">—</span><span>Chưa có API cuộc gọi nhỡ</span></div>
            </div>

            <div className="calls-new-section">
              <h3>Bắt đầu cuộc gọi mới</h3>
              <div className="call-contacts-list">
                {contacts.filter(c => c.online).map((c) => (
                  <div key={c.id} className="call-contact-row">
                    <span className={`avatar avatar-${c.color}`}>{c.initials}<span className={c.online ? "presence-dot" : "presence-dot offline"} /></span>
                    <div>
                      <strong>{c.name}</strong>
                      <span>{c.role}</span>
                    </div>
                    <div className="call-contact-actions">
                      <button className={`call-action-btn ${!c.online ? "disabled" : ""}`} onClick={() => void startCall(c, "voice")} title="Gọi thoại">
                        <Icon name="call" size={16} />
                      </button>
                      <button className={`call-action-btn video ${!c.online ? "disabled" : ""}`} onClick={() => void startCall(c, "video")} title="Gọi video">
                        <Icon name="camera" size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── Settings Tab ─────────────────────────────────────────────────── */}
      {activeTab === "settings" && (
        <section className="full-panel">
          <div className="full-sidebar settings-sidebar">
            <header className="panel-heading" style={{ paddingBottom: 14 }}>
              <div>
                <p className="eyebrow">LAN WORKSPACE</p>
                <h1>Cài đặt</h1>
              </div>
            </header>
            <div className="settings-profile-mini">
              <button className="avatar avatar-me settings-avatar">TN<span className="presence-dot" /></button>
              <div>
                <strong>{user.displayName}</strong>
                <span>@{user.username}</span>
              </div>
            </div>
            <nav className="settings-nav">
              {(["profile", "network", "notifications", "security", "appearance"] as const).map((s) => {
                const labels = { profile: "Hồ sơ cá nhân", network: "Mạng & kết nối", notifications: "Thông báo", security: "Bảo mật", appearance: "Giao diện" };
                const icons: Record<string, IconName> = { profile: "user", network: "wifi", notifications: "bell", security: "shield", appearance: "grid" };
                return (
                  <button key={s} className={`settings-nav-item ${settingsSection === s ? "active" : ""}`} onClick={() => setSettingsSection(s)}>
                    <Icon name={icons[s]} size={17} />
                    <span>{labels[s]}</span>
                    <Icon name="chevron" size={15} />
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="full-main settings-main">
            {settingsSection === "profile" && (
              <div className="settings-section">
                <h2>Hồ sơ cá nhân</h2>
                <div className="settings-avatar-block">
                  <button className="avatar avatar-me settings-avatar-lg">{user.displayName.slice(0, 1).toUpperCase()}<span className="presence-dot" /></button>
                  <div>
                    <button className="settings-upload-btn" onClick={() => showNotice("Chọn ảnh đại diện...")}>Thay đổi ảnh</button>
                    <p>PNG, JPG tối đa 5MB</p>
                  </div>
                </div>
                <div className="settings-form">
                  <div className="settings-field">
                    <label>Họ và tên</label>
                    <input value={user.displayName} readOnly />
                  </div>
                  <div className="settings-field">
                    <label>Tên hiển thị</label>
                    <input value={user.username} readOnly />
                  </div>
                  <div className="settings-field">
                    <label>Vai trò</label>
                    <input value={user.role === "ADMIN" ? "Quản trị viên" : "Thành viên"} readOnly />
                  </div>
                  <div className="settings-field">
                    <label>Trạng thái</label>
                    <select defaultValue="online">
                      <option value="online">Đang hoạt động</option>
                      <option value="busy">Bận</option>
                      <option value="away">Vắng mặt</option>
                      <option value="offline">Ngoại tuyến</option>
                    </select>
                  </div>
                </div>
                <p className="settings-subsection">Thông tin hồ sơ được quản lý bởi tài khoản hiện tại.</p>
              </div>
            )}

            {settingsSection === "network" && (
              <div className="settings-section">
                <h2>Mạng &amp; kết nối</h2>
                <div className="network-status-card">
                  <div className="network-status-icon connected"><Icon name="wifi" size={22} /></div>
                  <div>
                    <strong>Đã kết nối LAN</strong>
                    <p>Mạng nội bộ hoạt động bình thường</p>
                  </div>
                  <span className="net-badge connected">Ổn định</span>
                </div>
                <div className="settings-info-grid">
                  <div className="info-block"><span>Tài khoản</span><strong>@{user.username}</strong></div>
                  <div className="info-block"><span>Vai trò</span><strong>{user.role === "ADMIN" ? "Quản trị viên" : "Thành viên"}</strong></div>
                  <div className="info-block"><span>Thành viên</span><strong>{contacts.length}</strong></div>
                  <div className="info-block"><span>Đang trực tuyến</span><strong>{contacts.filter(c => c.online).length}</strong></div>
                </div>
                <h3 className="settings-subsection">Thiết bị đang kết nối</h3>
                <div className="devices-list">
                  {contacts.map((c) => (
                    <div key={c.id} className="device-row">
                      <span className={`avatar avatar-${c.color} small`}>{c.initials}<span className={c.online ? "presence-dot" : "presence-dot offline"} /></span>
                      <div>
                        <strong>{c.name}</strong>
                        <span>@{people.find(person => person.id === c.id)?.username}</span>
                      </div>
                      <span className={`net-badge ${c.online ? "connected" : ""}`}>{c.online ? "Online" : "Offline"}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {settingsSection === "notifications" && (
              <div className="settings-section">
                <h2>Thông báo</h2>
                <p className="settings-subsection">Các lựa chọn này chỉ áp dụng tạm thời trong phiên hiện tại.</p>
                <div className="settings-toggles">
                  <div className="toggle-row">
                    <div>
                      <strong>Thông báo tin nhắn</strong>
                      <span>Hiện thông báo khi có tin nhắn mới</span>
                    </div>
                    <button className={`toggle-switch ${notifChat ? "on" : ""}`} onClick={() => setNotifChat(!notifChat)}>
                      <span className="toggle-knob" />
                    </button>
                  </div>
                  <div className="toggle-row">
                    <div>
                      <strong>Thông báo cuộc gọi</strong>
                      <span>Hiện thông báo khi có cuộc gọi đến</span>
                    </div>
                    <button className={`toggle-switch ${notifCall ? "on" : ""}`} onClick={() => setNotifCall(!notifCall)}>
                      <span className="toggle-knob" />
                    </button>
                  </div>
                  <div className="toggle-row">
                    <div>
                      <strong>Thông báo tệp</strong>
                      <span>Hiện thông báo khi có tệp mới trong LAN Cloud</span>
                    </div>
                    <button className={`toggle-switch ${notifFile ? "on" : ""}`} onClick={() => setNotifFile(!notifFile)}>
                      <span className="toggle-knob" />
                    </button>
                  </div>
                  <div className="toggle-row">
                    <div>
                      <strong>Âm thanh thông báo</strong>
                      <span>Phát âm thanh khi có thông báo</span>
                    </div>
                    <button className={`toggle-switch ${notifSound ? "on" : ""}`} onClick={() => setNotifSound(!notifSound)}>
                      <span className="toggle-knob" />
                    </button>
                  </div>
                </div>
                <h3 className="settings-subsection">Chế độ không làm phiền</h3>
                <div className="dnd-block">
                  <p>Tắt tất cả thông báo trong khoảng thời gian nhất định</p>
                  <div className="dnd-time-row">
                    <div className="settings-field inline"><label>Từ</label><input type="time" defaultValue="22:00" /></div>
                    <div className="settings-field inline"><label>Đến</label><input type="time" defaultValue="07:00" /></div>
                  </div>
                  <button className="settings-save-btn" onClick={() => showNotice("Cài đặt thông báo áp dụng trong phiên hiện tại.")}>Áp dụng tạm thời</button>
                </div>
              </div>
            )}

            {settingsSection === "security" && (
              <div className="settings-section">
                <h2>Bảo mật</h2>
                <div className="security-status-card">
                  <div className="security-status-icon"><Icon name="shield" size={22} /></div>
                  <div>
                    <strong>Bảo mật tài khoản</strong>
                    <p>Phiên đăng nhập được xác thực bởi máy chủ LAN-Media.</p>
                  </div>
                  <span className="net-badge connected"><Icon name="check" size={12} />Bảo mật</span>
                </div>
                <p className="settings-subsection">Đổi mật khẩu chưa được hỗ trợ bởi backend hiện tại.</p>
                <h3 className="settings-subsection" style={{ marginTop: 28 }}>Quản lý phiên đăng nhập chưa được hỗ trợ bởi backend hiện tại.</h3>
              </div>
            )}

            {settingsSection === "appearance" && (
              <div className="settings-section">
                <h2>Giao diện</h2>
                <div className="settings-toggles">
                  <div className="toggle-row">
                    <div>
                      <strong>Chế độ tối</strong>
                      <span>Sử dụng nền tối cho toàn bộ ứng dụng</span>
                    </div>
                    <button className={`toggle-switch ${darkMode ? "on" : ""}`} onClick={() => { setDarkMode(!darkMode); showNotice("Tính năng đang phát triển"); }}>
                      <span className="toggle-knob" />
                    </button>
                  </div>
                  <div className="toggle-row">
                    <div>
                      <strong>Chế độ nhỏ gọn</strong>
                      <span>Thu nhỏ khoảng cách và phông chữ</span>
                    </div>
                    <button className={`toggle-switch ${compactMode ? "on" : ""}`} onClick={() => { setCompactMode(!compactMode); showNotice("Tính năng đang phát triển"); }}>
                      <span className="toggle-knob" />
                    </button>
                  </div>
                </div>
                <h3 className="settings-subsection">Màu sắc chủ đạo</h3>
                <div className="accent-colors">
                  {["#4968f3", "#7c3aed", "#0891b2", "#059669", "#d97706", "#dc2626"].map((color) => (
                    <button key={color} className="accent-swatch" style={{ background: color }} onClick={() => showNotice("Tính năng đang phát triển")} />
                  ))}
                </div>
                <h3 className="settings-subsection">Kích thước chữ</h3>
                <div className="font-sizes">
                  {["Nhỏ", "Vừa", "Lớn"].map((size, i) => (
                    <button key={size} className={`font-size-btn ${i === 1 ? "active" : ""}`} onClick={() => showNotice("Tính năng đang phát triển")}>{size}</button>
                  ))}
                </div>
                <div className="settings-version">
                  <span>LAN-Media</span>
                  <span>Giao diện phiên bản hiện tại</span>
                </div>
              </div>
            )}
          </div>
        </section>
      )}
    </main>
  );
}
