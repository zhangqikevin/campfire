interface FormErrorProps {
  errors?: string[];
  id?: string;
}

export function FormError({ errors, id }: FormErrorProps) {
  if (!errors?.length) return null;
  return (
    <p id={id} role="alert" className="text-sm text-danger">
      {errors[0]}
    </p>
  );
}
