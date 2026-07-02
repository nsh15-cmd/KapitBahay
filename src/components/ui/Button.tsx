import React from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: ButtonVariant;
    size?: ButtonSize;
    className?: string;
}

const variantStyles: Record<ButtonVariant, string> = {
    primary: "bg-amber-500 text-slate-950 hover:bg-amber-400 border border-transparent",
    secondary: "bg-slate-900 text-white hover:bg-slate-800 border border-slate-700",
    ghost: "bg-transparent text-teal-400 hover:bg-teal-500/10 border border-teal-500/20",
    danger: "bg-red-500 text-white hover:bg-red-400 border border-transparent",
};

const sizeStyles: Record<ButtonSize, string> = {
    sm: "px-3 py-2 text-sm",
    md: "px-4 py-3 text-sm",
    lg: "px-5 py-3 text-base",
};

export function Button({
    variant = "primary",
    size = "md",
    className = "",
    children,
    ...rest
}: ButtonProps) {
    return (
        <button
            className={`inline-flex items-center justify-center gap-2 rounded-2xl font-semibold transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-400 ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
            {...rest}
        >
            {children}
        </button>
    );
}
