import type { AuthUser } from '../api/AuthApi';

export default function ProfilePage({ user, onChangeAvatar }: { user: AuthUser; onChangeAvatar: () => void }) {
  return (
    <section className="profile-page">
      <header className="profile-page-header">
        <p className="eyebrow">LAN WORKSPACE</p>
        <h1>Hồ sơ cá nhân</h1>
      </header>
      <div className="profile-page-content">
        <div className="settings-avatar-block">
          <span className="avatar avatar-me settings-avatar-lg">{user.displayName.trim().slice(0, 1).toUpperCase()}<span className="presence-dot" /></span>
          <div>
            <strong className="profile-display-name">{user.displayName}</strong>
            <small className="profile-username">@{user.username}</small>
            <button className="settings-upload-btn" onClick={onChangeAvatar}>Thay đổi ảnh</button>
            <p>PNG, JPG tối đa 5MB</p>
          </div>
        </div>
        <div className="settings-form profile-fields">
          <div className="settings-field">
            <label>Họ và tên</label>
            <input value={user.displayName} readOnly />
          </div>
          <div className="settings-field">
            <label>Tên đăng nhập</label>
            <input value={user.username} readOnly />
          </div>
          <div className="settings-field">
            <label>Vai trò</label>
            <input value={user.role === 'ADMIN' ? 'Quản trị viên' : 'Thành viên'} readOnly />
          </div>
        </div>
        <p className="profile-note">Thông tin hồ sơ được quản lý bởi tài khoản hiện tại.</p>
      </div>
    </section>
  );
}
