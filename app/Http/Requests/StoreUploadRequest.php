<?php

namespace App\Http\Requests;

use App\Support\ApiException;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Http\UploadedFile;

class StoreUploadRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'file' => [
                'required',
                'file',
                'max:25600',
                function (string $attribute, mixed $value, \Closure $fail): void {
                    if (! $value instanceof UploadedFile || ! $value->isValid()) {
                        $fail('No file uploaded');

                        return;
                    }

                    $mime = (string) $value->getMimeType();
                    $original = (string) $value->getClientOriginalName();
                    $isPdf = $mime === 'application/pdf' || (bool) preg_match('/\.pdf$/i', $original);
                    $isImage = (bool) preg_match('#^image/(png|jpeg|webp)$#i', $mime)
                        || (bool) preg_match('/\.(png|jpe?g|webp)$/i', $original);

                    if (! $isPdf && ! $isImage) {
                        $fail('Only PDF or image files are allowed');
                    }
                },
            ],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'file.required' => 'No file uploaded',
            'file.file' => 'No file uploaded',
            'file.max' => 'File too large (max 25MB)',
        ];
    }

    protected function failedValidation(Validator $validator): void
    {
        throw new ApiException(400, (string) $validator->errors()->first());
    }
}
