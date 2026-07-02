import React from "react";

interface CardProps {
    className?: string;
    children: React.ReactNode;
}

export function Card({ className = "", children }: CardProps) {
    return (
        <div className={`rounded-3xl border border-slate-800/80 bg-[#0D1B35] shadow-2xl shadow-black/20 p-6 ${className}`}>
            {children}
        </div>
    );
}
