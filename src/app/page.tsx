import dynamic from 'next/dynamic';

const Dashboard = dynamic(() => import('@/components/Dashboard'), { ssr: false });

export default function Page() {
  return (
    <main style={{ maxWidth: 920, margin: '0 auto', padding: '1.5rem 1rem' }}>
      <h1 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1rem' }}>
        Stock Signal Dashboard
      </h1>
      <Dashboard />
    </main>
  );
}
