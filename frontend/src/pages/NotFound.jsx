import { Compass } from 'lucide-react';
import Button from '../components/ui/Button';
import { EmptyState } from '../components/ui/States';

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl px-4 py-20">
      <EmptyState
        icon={Compass}
        title="Page not found"
        message="The page you're looking for doesn't exist or has moved."
        action={<Button to="/">Back to events</Button>}
      />
    </div>
  );
}
