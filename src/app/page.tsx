'use client';

import Link from 'next/link';
export default function HomePage() {
  return (
    <div
      className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden"
      style={{
        backgroundImage: "url('/bg2.webp')",
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >

      {/* Logo */}
      <img
        src="/logo.webp"
        alt="Logo"
        className="absolute top-6 left-6 z-20"
        style={{ width: '100px', height: 'auto' }}
      />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center gap-6">
        <img
          src="/title.webp"
          alt="Echoes"
          className="select-none"
          style={{ width: '700px', height: 'auto', marginBottom: '-10px' }}
        />

        <p
          className="text-lg font-bold tracking-wide italic"
          style={{ color: '#C0DDDA' }}
        >
          A visual community wall for any occasion.
        </p>

        <div className="flex gap-5 flex-wrap justify-center">
          {/* Playground button */}
          <Link
            href="/w/playground?contribute=1"
            className="px-10 py-3 text-base font-semibold tracking-widest uppercase select-none rounded-xl text-center"
            style={{
              backgroundColor: '#FBE29D',
              color: '#775537',
              border: '2px solid #775537',
              boxShadow: '0 5px 0 #775537, 0 6px 12px rgba(119,85,55,0.2)',
              transition: 'all 0.1s ease',
              minWidth: '200px',
              transform: 'translateY(0)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 7px 0 #775537, 0 10px 18px rgba(119,85,55,0.25)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 5px 0 #775537, 0 6px 12px rgba(119,85,55,0.2)';
            }}
            onMouseDown={(e) => {
              e.currentTarget.style.transform = 'translateY(3px)';
              e.currentTarget.style.boxShadow = '0 2px 0 #775537, 0 2px 4px rgba(119,85,55,0.2)';
            }}
            onMouseUp={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 5px 0 #775537, 0 6px 12px rgba(119,85,55,0.2)';
            }}
          >
            <span className="text-sm tracking-wide">Quick Try</span><br />
            <span className="text-sm font-normal normal-case tracking-normal">Instant demo, no setup</span>
          </Link>

          {/* Create button */}
          <Link
            href="/create"
            className="px-10 py-3 text-base font-semibold tracking-widest uppercase select-none rounded-xl text-center"
            style={{
              backgroundColor: '#775537',
              color: '#FBE29D',
              border: '2px solid #5a3f2a',
              boxShadow: '0 5px 0 #5a3f2a, 0 6px 12px rgba(119,85,55,0.2)',
              transition: 'all 0.1s ease',
              minWidth: '200px',
              transform: 'translateY(0)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 7px 0 #5a3f2a, 0 10px 18px rgba(119,85,55,0.25)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 5px 0 #5a3f2a, 0 6px 12px rgba(119,85,55,0.2)';
            }}
            onMouseDown={(e) => {
              e.currentTarget.style.transform = 'translateY(3px)';
              e.currentTarget.style.boxShadow = '0 2px 0 #5a3f2a, 0 2px 4px rgba(119,85,55,0.2)';
            }}
            onMouseUp={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 5px 0 #5a3f2a, 0 6px 12px rgba(119,85,55,0.2)';
            }}
          >
            <span className="text-sm tracking-wide">Create Wall</span><br />
            <span className="text-sm font-normal normal-case tracking-normal">Your own permanent wall</span>
          </Link>
        </div>
      </div>
    </div>
  );
}