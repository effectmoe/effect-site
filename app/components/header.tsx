import { Link } from "react-router";

export function Header() {
  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
        <Link to="/" className="text-xl font-bold text-gray-900">
          effect.moe
        </Link>
        <nav className="flex gap-6 text-sm text-gray-600">
          <Link to="/" className="hover:text-gray-900">Home</Link>
          <Link to="/articles" className="hover:text-gray-900">Articles</Link>
          <Link to="/about" className="hover:text-gray-900">About</Link>
        </nav>
      </div>
    </header>
  );
}
