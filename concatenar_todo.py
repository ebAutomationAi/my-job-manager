import os

def concatenar_todo_a_txt(archivo_salida="todo_el_codigo.txt"):
    with open(archivo_salida, 'w', encoding='utf-8', errors='ignore') as f_salida:
        for raiz, dirs, archivos in os.walk('.'):
            for archivo in archivos:
                ruta_archivo = os.path.join(raiz, archivo)
                try:
                    with open(ruta_archivo, 'r', encoding='utf-8', errors='ignore') as f_entrada:
                        contenido = f_entrada.read()
                        f_salida.write(f"\n\n{'='*80}\n")
                        f_salida.write(f"Archivo: {ruta_archivo}\n")
                        f_salida.write(f"{'='*80}\n\n")
                        f_salida.write(contenido)
                except Exception as e:
                    f_salida.write(f"\n\n{'='*80}\n")
                    f_salida.write(f"Archivo (no se pudo leer): {ruta_archivo}\n")
                    f_salida.write(f"Error: {str(e)}\n")
                    f_salida.write(f"{'='*80}\n\n")
    print(f"Todos los archivos han sido concatenados en: {archivo_salida}")

# Ejecutar el script
concatenar_todo_a_txt()