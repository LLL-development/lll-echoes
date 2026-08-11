export const runtime = 'edge';

export default function NotFound() {
  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#fffef9',
        fontFamily: "'Patrick Hand', cursive",
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: 16,
      }}
    >
      <h1 style={{ fontSize: 48, color: '#775537' }}>404 — Not Found</h1>
      <p style={{ fontSize: 20, color: '#775537', opacity: 0.7 }}>
        The page you are looking for does not exist.
      </p>
    </div>
  );
}
