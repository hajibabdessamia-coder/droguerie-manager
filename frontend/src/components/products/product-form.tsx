'use client';

import { useRouter } from 'next/navigation';
import { useState, type ChangeEvent, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { ImagePlus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { createManufacturer, fetchManufacturers } from '@/lib/manufacturers';
import { createProduct, updateProduct, uploadProductImage, type ProductInput } from '@/lib/products';
import { PRODUCT_GROUPS, PRODUCT_GROUP_LABELS } from '@/lib/product-groups';
import type { Product, ProductGroup } from '@/types';

export function ProductForm({ product }: { product?: Product }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const isEdit = Boolean(product);

  const { data: manufacturers } = useQuery({ queryKey: ['manufacturers'], queryFn: fetchManufacturers });

  const [name, setName] = useState(product?.name ?? '');
  const [internalCode, setInternalCode] = useState(product?.internalCode ?? '');
  const [group, setGroup] = useState<ProductGroup>(product?.group ?? 'GROUP_1');
  const [manufacturerId, setManufacturerId] = useState(product?.manufacturerId ?? '');
  const [purchasePrice, setPurchasePrice] = useState(product?.purchasePrice ?? '');
  const [retailPrice, setRetailPrice] = useState(product?.retailPrice ?? '');
  const [wholesalePrice, setWholesalePrice] = useState(product?.wholesalePrice ?? '');
  const [quantity, setQuantity] = useState('0');
  const [minStock, setMinStock] = useState(product?.minStock?.toString() ?? '0');
  const [notes, setNotes] = useState(product?.notes ?? '');

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(product?.imageUrl ?? null);
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      let imageUrl = product?.imageUrl ?? undefined;
      if (imageFile) imageUrl = await uploadProductImage(imageFile);

      const input: ProductInput = {
        name,
        internalCode,
        group,
        manufacturerId: manufacturerId || undefined,
        purchasePrice: Number(purchasePrice),
        retailPrice: Number(retailPrice),
        wholesalePrice: Number(wholesalePrice),
        minStock: Number(minStock),
        notes: notes || undefined,
        imageUrl,
        ...(isEdit ? {} : { quantity: Number(quantity) }),
      };

      return isEdit && product ? updateProduct(product.id, input) : createProduct(input);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['products'] });
      router.push('/products');
    },
    onError: (err) => {
      const message = isAxiosError(err) ? err.response?.data?.message : undefined;
      setError(message ?? 'حدث خطأ أثناء الحفظ');
    },
  });

  function handleImageChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  }

  async function handleAddManufacturer() {
    const value = window.prompt('اسم الشركة المصنعة الجديدة؟');
    if (!value) return;
    const manufacturer = await createManufacturer(value);
    await queryClient.invalidateQueries({ queryKey: ['manufacturers'] });
    setManufacturerId(manufacturer.id);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    mutation.mutate();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <Card>
        <CardContent className="flex flex-col gap-4 p-5">
          <div className="flex items-center gap-4">
            <label className="flex h-20 w-20 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-xl border border-dashed border-border bg-muted">
              {imagePreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={imagePreview} alt="" className="h-full w-full object-cover" />
              ) : (
                <ImagePlus className="h-6 w-6 text-muted-foreground" />
              )}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={handleImageChange}
              />
            </label>
            <p className="text-sm text-muted-foreground">صورة المنتج (JPG, PNG, WEBP، حتى 5MB)</p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="name">اسم المنتج</Label>
              <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="internalCode">الكود الداخلي</Label>
              <Input id="internalCode" required value={internalCode} onChange={(e) => setInternalCode(e.target.value)} />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="group">فئة نقطة البيع</Label>
              <Select id="group" value={group} onChange={(e) => setGroup(e.target.value as ProductGroup)}>
                {PRODUCT_GROUPS.map((g) => (
                  <option key={g} value={g}>
                    {PRODUCT_GROUP_LABELS[g]}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="manufacturerId">الشركة المصنعة</Label>
              <div className="flex gap-2">
                <Select id="manufacturerId" value={manufacturerId} onChange={(e) => setManufacturerId(e.target.value)}>
                  <option value="">بدون شركة مصنعة</option>
                  {manufacturers?.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </Select>
                <Button type="button" variant="outline" size="icon" onClick={handleAddManufacturer}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="purchasePrice">سعر الشراء</Label>
              <Input
                id="purchasePrice"
                type="number"
                step="0.01"
                min="0"
                required
                value={purchasePrice}
                onChange={(e) => setPurchasePrice(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="retailPrice">سعر البيع بالتقسيط</Label>
              <Input
                id="retailPrice"
                type="number"
                step="0.01"
                min="0"
                required
                value={retailPrice}
                onChange={(e) => setRetailPrice(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="wholesalePrice">سعر البيع بالجملة</Label>
              <Input
                id="wholesalePrice"
                type="number"
                step="0.01"
                min="0"
                required
                value={wholesalePrice}
                onChange={(e) => setWholesalePrice(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="minStock">الحد الأدنى للمخزون</Label>
              <Input
                id="minStock"
                type="number"
                min="0"
                required
                value={minStock}
                onChange={(e) => setMinStock(e.target.value)}
              />
            </div>

            {!isEdit && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="quantity">الكمية الأولية</Label>
                <Input
                  id="quantity"
                  type="number"
                  min="0"
                  required
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                />
              </div>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="notes">ملاحظات</Label>
            <Textarea id="notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => router.push('/products')}>
          إلغاء
        </Button>
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? 'جارٍ الحفظ...' : isEdit ? 'حفظ التعديلات' : 'إضافة المنتج'}
        </Button>
      </div>
    </form>
  );
}
