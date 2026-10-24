export function Toolbar({ loading, onSave }) {
  return (
    <div className="flex gap-2 border border-gray-200 p-2">
      {loading && <div className="animate-spin h-4 w-4 rounded-full border-2" />}
      <button onClick={onSave}>Save</button>
      <button onClick={() => {}}>Share</button>
      <button className="icon"><svg viewBox="0 0 24 24"><path d="M4 4h16v16H4z" /></svg></button>
      <a href="#">Help</a>
    </div>
  );
}
