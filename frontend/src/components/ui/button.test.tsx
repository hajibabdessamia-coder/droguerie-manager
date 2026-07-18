import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from './button';

describe('Button', () => {
  it('renders its children', () => {
    render(<Button>إضافة منتج</Button>);
    expect(screen.getByRole('button', { name: 'إضافة منتج' })).toBeInTheDocument();
  });

  it('fires onClick when clicked', () => {
    const onClick = jest.fn();
    render(<Button onClick={onClick}>حفظ</Button>);
    fireEvent.click(screen.getByRole('button', { name: 'حفظ' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('does not fire onClick when disabled', () => {
    const onClick = jest.fn();
    render(
      <Button onClick={onClick} disabled>
        حفظ
      </Button>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'حفظ' }));
    expect(onClick).not.toHaveBeenCalled();
  });

  it('applies the destructive variant class', () => {
    render(<Button variant="destructive">حذف</Button>);
    expect(screen.getByRole('button', { name: 'حذف' }).className).toContain('bg-destructive');
  });
});
