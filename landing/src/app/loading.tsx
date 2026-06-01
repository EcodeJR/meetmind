"use client";
"use client";
import React from 'react';

export default function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-black text-white overflow-hidden">
      <div className="center-wrap">
        <div className="center">
          <svg className="logo" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="50" cy="50" r="28" stroke="currentColor" strokeWidth="6" opacity="0.08" />
            <path d="M50 26 A24 24 0 0 1 74 50" stroke="white" strokeWidth="6" strokeLinecap="round" />
          </svg>
          <h2 className="appName">Memovoice</h2>
          <div className="spinner" aria-hidden />
        </div>
      </div>

      <style jsx>{`
        .center-wrap { width:100%; height:100%; display:flex; align-items:center; justify-content:center; }
        .center { display:flex; flex-direction:column; align-items:center; gap:12px; transform:translateY(0); animation: slideUpOut 0.9s ease-in-out 1.6s forwards; }
        .logo { width:88px; height:88px; color: #fff; }
        .appName { margin-top:8px; font-size:20px; font-weight:600; color:#fff; }
        .spinner { width:36px; height:36px; border-radius:50%; border:4px solid rgba(255,255,255,0.08); border-top-color:#fff; animation: spin 1s linear infinite; margin-top:6px }

        @keyframes spin { to { transform: rotate(1turn); } }
        @keyframes slideUpOut { 0% { transform: translateY(0); opacity:1 } 80% { transform: translateY(0); opacity:1 } 100% { transform: translateY(-120%); opacity:0 } }
      `}</style>
    </div>
  );
}
