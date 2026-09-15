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
import { createCategory, fetchCategories } from '@/lib/categories';
import { createUnit, fetchUnits } from '@/lib/units';
import { createProduct, updateProduct, uploadProductImage, type ProductInput } from '@/lib/products';
import { useLocale } from '@/i18n/locale-provider';
import type { Product } from '@/types';

export function ProductForm({ product }: { product?: Product }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { t } = useLocale();
  const isEdit = Boolean(product);

  const { data: manufacturers } = useQuery({ queryKey: ['manufacturers'], queryFn: fetchManufacturers });
  const { data: categories } = useQuery({ queryKey: ['categories'], queryFn: fetchCategories });
  const { data: units } = useQuery({ queryKey: ['units'], queryFn: fetchUnits });

  const [name, setName] = useState(product?.name ?? '');
  const [internalCode, setInternalCode] = useState(product?.internalCode ?? '');
  const [categoryId, setCategoryId] = useState(product?.categoryId ?? '');
  const [unitId, setUnitId] = useState(product?.unitId ?? '');
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
        categoryId: categoryId || undefined,
        unitId: unitId || undefined,
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
      setError(message ?? t('productForm.genericError'));
    },
  });

  function handleImageChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  }

  async function handleAddManufacturer() {
    const value = window.prompt(t('productForm.addManufacturerPrompt'));
    if (!value) return;
    const manufacturer = await createManufacturer(value);
    await queryClient.invalidateQueries({ queryKey: ['manufacturers'] });
    setManufacturerId(manufacturer.id);
  }

  async function handleAddCategory() {
    const value = window.prompt(t('productForm.addCategoryPrompt'));
    if (!value) return;
    const category = await createCategory(value);
    await queryClient.invalidateQueries({ queryKey: ['categories'] });
    setCategoryId(category.id);
  }

  async function handleAddUnit() {
    const value = window.prompt(t('productForm.addUnitPrompt'));
    if (!value) return;
    const unit = await createUnit(value);
    await queryClient.invalidateQueries({ queryKey: ['units'] });
    setUnitId(unit.id);
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
            <p className="text-sm text-muted-foreground">{t('productForm.imageHint')}</p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="name">{t('productForm.nameLabel')}</Label>
              <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="internalCode">{t('productForm.internalCodeLabel')}</Label>
              <Input id="internalCode" required value={internalCode} onChange={(e) => setInternalCode(e.target.value)} />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="categoryId">{t('productForm.categoryLabel')}</Label>
              <div className="flex gap-2">
                <Select id="categoryId" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                  <option value="">{t('productForm.noCategory')}</option>
                  {categories?.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
                <Button type="button" variant="outline" size="icon" onClick={handleAddCategory}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="unitId">{t('productForm.unitLabel')}</Label>
              <div className="flex gap-2">
                <Select id="unitId" value={unitId} onChange={(e) => setUnitId(e.target.value)}>
                  <option value="">{t('productForm.noUnit')}</option>
                  {units?.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </Select>
                <Button type="button" variant="outline" size="icon" onClick={handleAddUnit}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="manufacturerId">{t('productForm.manufacturerLabel')}</Label>
              <div className="flex gap-2">
                <Select id="manufacturerId" value={manufacturerId} onChange={(e) => setManufacturerId(e.target.value)}>
                  <option value="">{t('productForm.noManufacturer')}</option>
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
              <Label htmlFor="purchasePrice">{t('productForm.purchasePriceLabel')}</Label>
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
              <Label htmlFor="retailPrice">{t('productForm.retailPriceLabel')}</Label>
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
              <Label htmlFor="wholesalePrice">{t('productForm.wholesalePriceLabel')}</Label>
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
              <Label htmlFor="minStock">{t('productForm.minStockLabel')}</Label>
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
                <Label htmlFor="quantity">{t('productForm.initialQuantityLabel')}</Label>
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
            <Label htmlFor="notes">{t('productForm.notesLabel')}</Label>
            <Textarea id="notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => router.push('/products')}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? t('productForm.saving') : isEdit ? t('productForm.saveChanges') : t('productForm.addProduct')}
        </Button>
      </div>
    </form>
  );
}
