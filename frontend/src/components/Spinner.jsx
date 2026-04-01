export default function Spinner() {
  return (
    <div className="py-10">
      <div className="w-8 h-8 border-4 border-gray-300 border-t-indigo-600 rounded-full animate-spin"></div>
      <p>Loading...</p>
    </div>
  );
}