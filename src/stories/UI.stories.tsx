import type { Meta, StoryObj } from '@storybook/react';
import { Button, Card, Badge, Avatar, EmptyState } from '@/components/ui';

const meta: Meta<typeof Button> = {
  title: 'UI/Button',
  component: Button,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof Button>;

export const Primary: Story = { args: { children: 'Primary', variant: 'primary' } };
export const Secondary: Story = { args: { children: 'Secondary', variant: 'secondary' } };
export const Danger: Story = { args: { children: 'Danger', variant: 'danger' } };
export const Ghost: Story = { args: { children: 'Ghost', variant: 'ghost' } };
export const Small: Story = { args: { children: 'Small', size: 'sm' } };
export const Large: Story = { args: { children: 'Large', size: 'lg' } };
export const Disabled: Story = { args: { children: 'Disabled', disabled: true } };

export const CardStory: Meta<typeof Card> = {
  title: 'UI/Card',
  component: Card,
  tags: ['autodocs'],
  render: () => (
    <Card className="p-6">
      <h3 className="font-bold text-lg">Card Title</h3>
      <p className="text-sm text-slate-500 mt-2">Card content goes here.</p>
    </Card>
  ),
};

export const BadgeStory: Meta<typeof Badge> = {
  title: 'UI/Badge',
  component: Badge,
  tags: ['autodocs'],
  render: () => (
    <div className="flex gap-2">
      <Badge>Default</Badge>
      <Badge variant="success">Success</Badge>
      <Badge variant="warning">Warning</Badge>
      <Badge variant="danger">Danger</Badge>
      <Badge variant="info">Info</Badge>
    </div>
  ),
};

export const AvatarStory: Meta<typeof Avatar> = {
  title: 'UI/Avatar',
  component: Avatar,
  tags: ['autodocs'],
  render: () => (
    <div className="flex gap-3">
      <Avatar name="Marie Dupont" />
      <Avatar name="Jean Martin" size={12} />
      <Avatar name="Admin" size={14} />
    </div>
  ),
};

export const EmptyStateStory: Meta<typeof EmptyState> = {
  title: 'UI/EmptyState',
  component: EmptyState,
  tags: ['autodocs'],
  render: () => (
    <EmptyState
      icon="📭"
      title="Aucun résultat"
      description="Il n'y a rien à afficher pour le moment."
      action={<button className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold">Créer</button>}
    />
  ),
};
