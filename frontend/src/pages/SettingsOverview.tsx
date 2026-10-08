export type SettingsSection = 'general' | 'network' | 'notifications' | 'security' | 'appearance';

const settingCards: { id: SettingsSection; title: string; description: string; symbol: string }[] = [
  { id: 'network', title: 'Mạng & kết nối', description: 'Kiểm tra trạng thái kết nối trong LAN.', symbol: '⌁' },
  { id: 'notifications', title: 'Thông báo', description: 'Chọn loại thông báo muốn nhận.', symbol: '♧' },
  { id: 'security', title: 'Bảo mật', description: 'Tùy chọn bảo vệ tài khoản.', symbol: '◇' },
  { id: 'appearance', title: 'Giao diện', description: 'Điều chỉnh giao diện và cách hiển thị.', symbol: '▦' },
];

export default function SettingsOverview({ onSelect }: { onSelect: (section: SettingsSection) => void }) {
  return (
    <div className="settings-section">
      <h2>Cài đặt chung</h2>
      <p className="settings-subsection">Quản lý kết nối, thông báo và cách LAN Workspace hoạt động.</p>
      <div className="settings-general-grid">
        {settingCards.map(({ id, title, description, symbol }) => (
          <button key={id} className="settings-general-card" type="button" onClick={() => onSelect(id)}>
            <span className="settings-general-symbol" aria-hidden="true">{symbol}</span>
            <span><strong>{title}</strong><small>{description}</small></span>
            <span aria-hidden="true">›</span>
          </button>
        ))}
      </div>
    </div>
  );
}
