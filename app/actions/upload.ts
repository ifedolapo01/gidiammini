// app/actions/upload.ts - product image upload for the admin product form.
'use server';

import { createClient } from '@supabase/supabase-js';
import { isAdminRequest } from '@/lib/api/require-admin';
import { magicBytesMatch } from '@/lib/commerce/receipt-file';

export async function uploadProductImage(formData: FormData) {
  try {
    // A Server Action is a POST endpoint reachable by anyone who can load the
    // page it's imported into. Without this check, the service-role key below
    // let any visitor write arbitrary files into the project's storage.
    if (!(await isAdminRequest())) {
      return { error: 'Not authorised. Please log in again.' };
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );
    
    const file = formData.get('image') as File;
    
    if (!file) {
      return { error: 'No file provided' };
    }

    // Mobile-specific checks
    const maxSize = 3 * 1024 * 1024; // 3MB for mobile (was 5MB)
    if (file.size > maxSize) {
      return { 
        error: `File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Max size is 3MB. Compress your image first.` 
      };
    }

    // Check file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return { error: `Invalid file type: ${file.type}. Use JPEG, PNG, or WebP.` };
    }

    const fileBuffer = await file.arrayBuffer();

    // The declared type is just a header value, so corroborate it against the
    // file's magic bytes before trusting it.
    if (!magicBytesMatch(new Uint8Array(fileBuffer), file.type)) {
      return { error: `That file doesn't look like a real ${file.type.replace('image/', '').toUpperCase()} image.` };
    }

    const fileName = `mobile_${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${file.type.split('/')[1]}`;

    // Upload with timeout for mobile networks
    const uploadPromise = supabaseAdmin.storage
      .from('product_images')
      .upload(fileName, fileBuffer, {
        contentType: file.type,
        upsert: false,
      });

    // Add timeout for mobile networks
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Upload timeout after 30 seconds')), 30000);
    });

    const { error: uploadError } = await Promise.race([uploadPromise, timeoutPromise]) as any;

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return { 
        error: `Upload failed: ${uploadError.message}. Try a smaller image or better connection.` 
      };
    }

    // Get public URL
    const { data: { publicUrl } } = supabaseAdmin.storage
      .from('product_images')
      .getPublicUrl(fileName);

    return { 
      success: true, 
      url: publicUrl,
      fileName,
      size: file.size
    };
  } catch (error: any) {
    console.error('Upload action error:', error);
    
    // Mobile-friendly error messages
    if (error.message.includes('timeout')) {
      return { error: 'Upload took too long. Check your internet connection and try a smaller image.' };
    }
    
    return { error: `Upload failed: ${error.message}. Please try again.` };
  }
}