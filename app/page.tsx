"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Upload,
  Search,
  Trash2,
  Eye,
  Skull,
  AlertTriangle,
  ArrowRight,
  X,
  Loader2,
  Heart,
  MessageCircle,
  Filter,
  Tag,
  Send,
} from "lucide-react"
import Image from "next/image"
import { supabase, type Photo, type PhotoComment, HORROR_CATEGORIES, getUserSession } from "@/lib/supabase"

export default function HorrorPhotoGallery() {
  const [showIntro, setShowIntro] = useState(true)
  const [photos, setPhotos] = useState<Photo[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<string>("all")
  const [sortBy, setSortBy] = useState<string>("newest")
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [likedPhotos, setLikedPhotos] = useState<Set<string>>(new Set())
  const [comments, setComments] = useState<PhotoComment[]>([])
  const [newComment, setNewComment] = useState("")
  const [userName, setUserName] = useState("")
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    category: "general",
    tags: "",
    file: null as File | null,
  })

  // Load photos and user likes on component mount
  useEffect(() => {
    loadPhotos()
    loadUserLikes()
  }, [])

  // Load comments when a photo is selected
  useEffect(() => {
    if (selectedPhoto) {
      loadComments(selectedPhoto.id)
    }
  }, [selectedPhoto])

  const loadPhotos = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase.from("horror_photos").select("*").order("created_at", { ascending: false })

      if (error) {
        console.error("Error loading photos:", error)
        return
      }

      setPhotos(data || [])
    } catch (error) {
      console.error("Error loading photos:", error)
    } finally {
      setLoading(false)
    }
  }

  const loadUserLikes = async () => {
    try {
      const sessionId = getUserSession()
      const { data, error } = await supabase.from("photo_likes").select("photo_id").eq("user_session", sessionId)

      if (error) {
        // If table doesn't exist yet, just continue without likes
        if (error.code === "PGRST116" || error.message.includes("does not exist")) {
          console.log("Likes table not yet created - likes functionality disabled")
          return
        }
        console.error("Error loading likes:", error)
        return
      }

      const likedIds = new Set(data?.map((like) => like.photo_id) || [])
      setLikedPhotos(likedIds)
    } catch (error) {
      console.error("Error loading likes:", error)
    }
  }

  const loadComments = async (photoId: string) => {
    try {
      const { data, error } = await supabase
        .from("photo_comments")
        .select("*")
        .eq("photo_id", photoId)
        .order("created_at", { ascending: true })

      if (error) {
        // If table doesn't exist yet, just continue without comments
        if (error.code === "PGRST116" || error.message.includes("does not exist")) {
          console.log("Comments table not yet created - comments functionality disabled")
          setComments([])
          return
        }
        console.error("Error loading comments:", error)
        return
      }

      setComments(data || [])
    } catch (error) {
      console.error("Error loading comments:", error)
      setComments([])
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setFormData((prev) => ({ ...prev, file }))
    }
  }

  const uploadImage = async (file: File): Promise<string | null> => {
    const fileExt = file.name.split(".").pop()
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`

    const { data, error } = await supabase.storage.from("horror-images").upload(fileName, file)

    if (error) {
      console.error("Error uploading image:", error)
      return null
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("horror-images").getPublicUrl(fileName)

    return publicUrl
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.file || !formData.name) return

    setUploading(true)
    try {
      const imageUrl = await uploadImage(formData.file)
      if (!imageUrl) {
        alert("Error al subir la imagen")
        return
      }

      const tags = formData.tags
        .split(",")
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0)

      const { error } = await supabase.from("horror_photos").insert([
        {
          name: formData.name,
          description: formData.description,
          image_url: imageUrl,
          category: formData.category,
          tags: tags,
        },
      ])

      if (error) {
        console.error("Error saving photo:", error)
        alert("Error al guardar la foto")
        return
      }

      setFormData({ name: "", description: "", category: "general", tags: "", file: null })
      const fileInput = document.getElementById("photo-upload") as HTMLInputElement
      if (fileInput) fileInput.value = ""

      await loadPhotos()
    } catch (error) {
      console.error("Error uploading photo:", error)
      alert("Error al subir la foto")
    } finally {
      setUploading(false)
    }
  }

  const toggleLike = async (photo: Photo) => {
    try {
      const sessionId = getUserSession()
      const isLiked = likedPhotos.has(photo.id)

      if (isLiked) {
        // Remove like
        const { error } = await supabase
          .from("photo_likes")
          .delete()
          .eq("photo_id", photo.id)
          .eq("user_session", sessionId)

        if (error) {
          if (error.code === "PGRST116" || error.message.includes("does not exist")) {
            alert("La funcionalidad de likes aún no está disponible. Por favor, ejecuta el script SQL primero.")
            return
          }
          throw error
        }

        setLikedPhotos((prev) => {
          const newSet = new Set(prev)
          newSet.delete(photo.id)
          return newSet
        })
      } else {
        // Add like
        const { error } = await supabase.from("photo_likes").insert([{ photo_id: photo.id, user_session: sessionId }])

        if (error) {
          if (error.code === "PGRST116" || error.message.includes("does not exist")) {
            alert("La funcionalidad de likes aún no está disponible. Por favor, ejecuta el script SQL primero.")
            return
          }
          throw error
        }

        setLikedPhotos((prev) => new Set([...prev, photo.id]))
      }

      // Refresh photos to get updated like count
      await loadPhotos()
    } catch (error) {
      console.error("Error toggling like:", error)
      alert("Error al procesar el like")
    }
  }

  const addComment = async () => {
    if (!selectedPhoto || !newComment.trim() || !userName.trim()) return

    try {
      const { error } = await supabase.from("photo_comments").insert([
        {
          photo_id: selectedPhoto.id,
          user_name: userName.trim(),
          comment: newComment.trim(),
        },
      ])

      if (error) {
        if (error.code === "PGRST116" || error.message.includes("does not exist")) {
          alert("La funcionalidad de comentarios aún no está disponible. Por favor, ejecuta el script SQL primero.")
          return
        }
        throw error
      }

      setNewComment("")
      await loadComments(selectedPhoto.id)
    } catch (error) {
      console.error("Error adding comment:", error)
      alert("Error al añadir comentario")
    }
  }

  const deletePhoto = async (photo: Photo) => {
    try {
      const { error: dbError } = await supabase.from("horror_photos").delete().eq("id", photo.id)

      if (dbError) {
        console.error("Error deleting photo from database:", dbError)
        return
      }

      const fileName = photo.image_url.split("/").pop()
      if (fileName) {
        const { error: storageError } = await supabase.storage.from("horror-images").remove([fileName])
        if (storageError) {
          console.error("Error deleting image from storage:", storageError)
        }
      }

      setPhotos((prev) => prev.filter((p) => p.id !== photo.id))
      if (selectedPhoto?.id === photo.id) {
        setSelectedPhoto(null)
      }
    } catch (error) {
      console.error("Error deleting photo:", error)
      alert("Error al eliminar la foto")
    }
  }

  // Filter and sort photos
  const filteredAndSortedPhotos = photos
    .filter((photo) => {
      const matchesSearch =
        photo.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        photo.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (photo.tags && photo.tags.some((tag) => tag.toLowerCase().includes(searchTerm.toLowerCase())))

      const matchesCategory = selectedCategory === "all" || photo.category === selectedCategory

      return matchesSearch && matchesCategory
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "likes":
          return (b.likes_count || 0) - (a.likes_count || 0)
        case "oldest":
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        case "newest":
        default:
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      }
    })

  // Intro Screen Component
  if (showIntro) {
    return (
      <div className="min-h-screen relative overflow-hidden bg-black flex items-center justify-center">
        {/* Disturbing Background */}
        <div className="fixed inset-0 bg-black">
          {/* Animated Horror Silhouettes for Intro */}
          <div className="absolute inset-0 overflow-hidden">
            {/* Sinister Trees */}
            <div className="absolute bottom-0 left-5 w-40 h-80 opacity-15 animate-sway-slow">
              <svg viewBox="0 0 100 200" className="w-full h-full fill-white">
                <path d="M50 200 L50 140 L45 130 L40 120 L35 110 L30 100 L25 90 L20 80 L15 70 L10 60 L5 50 L8 40 L12 30 L16 20 L20 10 L25 5 L30 2 L35 1 L40 0 L45 1 L50 2 L55 5 L60 10 L64 20 L68 30 L72 40 L75 50 L70 60 L65 70 L60 80 L55 90 L50 100 M25 85 L15 80 L5 75 L0 70 M75 85 L85 80 L95 75 L100 70 M30 120 L20 115 L10 110 L0 105 M70 120 L80 115 L90 110 L100 105 M35 150 L25 145 L15 140 M65 150 L75 145 L85 140" />
              </svg>
            </div>

            <div className="absolute bottom-0 right-10 w-36 h-72 opacity-12 animate-sway-slow-reverse">
              <svg viewBox="0 0 100 200" className="w-full h-full fill-white">
                <path d="M50 200 L50 150 L48 140 L46 130 L44 120 L42 110 L40 100 L38 90 L36 80 L34 70 L32 60 L30 50 L28 40 L26 30 L24 20 L22 10 L25 5 L30 2 L35 1 L40 0 L45 1 L50 2 L55 5 L60 10 L58 20 L56 30 L54 40 L52 50 L50 60 M32 95 L22 90 L12 85 L2 80 M54 95 L64 90 L74 85 L84 80 M38 135 L28 130 L18 125 L8 120 M62 135 L72 130 L82 125 L92 120" />
              </svg>
            </div>

            {/* Menacing Castle */}
            <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-64 h-40 opacity-8 animate-pulse-slow">
              <svg viewBox="0 0 200 100" className="w-full h-full fill-white">
                <path d="M0 100 L0 75 L15 75 L15 65 L25 65 L25 55 L35 55 L35 45 L45 45 L45 35 L55 35 L55 25 L65 25 L65 15 L75 15 L75 5 L85 5 L85 0 L95 0 L95 5 L105 5 L105 15 L115 15 L115 25 L125 25 L125 35 L135 35 L135 45 L145 45 L145 55 L155 55 L155 65 L165 65 L165 75 L180 75 L180 85 L190 85 L190 100 L200 100 L0 100 M75 25 L75 15 L85 15 L85 25 M105 25 L105 15 L115 15 L115 25 M45 55 L45 45 L55 45 L55 55 M125 55 L125 45 L135 45 L135 55" />
              </svg>
            </div>

            {/* Disturbing Creatures */}
            {[...Array(15)].map((_, i) => (
              <div
                key={i}
                className="absolute animate-fly-disturbing opacity-25"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `${10 + Math.random() * 60}%`,
                  animationDelay: `${Math.random() * 8}s`,
                  animationDuration: `${4 + Math.random() * 6}s`,
                }}
              >
                <svg width="18" height="14" viewBox="0 0 24 16" className="fill-white">
                  <path d="M12 8 L10 6 L8 4 L6 2 L4 1 L2 0 L0 1 L1 3 L3 5 L5 6 L7 7 L9 8 L12 9 L15 8 L17 7 L19 6 L21 5 L23 3 L24 1 L22 0 L20 1 L18 2 L16 4 L14 6 L12 8 M6 10 L4 12 L2 14 L0 16 M18 10 L20 12 L22 14 L24 16" />
                </svg>
              </div>
            ))}

            {/* Hanging Figures */}
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className="absolute animate-sway-disturbing opacity-10"
                style={{
                  left: `${15 + i * 20}%`,
                  top: `${5 + Math.random() * 15}%`,
                  animationDelay: `${i * 1.5}s`,
                  animationDuration: `${3 + i}s`,
                }}
              >
                <svg width="12" height="40" viewBox="0 0 12 40" className="fill-white">
                  <path d="M6 0 L6 15 M6 15 C4 15 2 17 2 20 L2 35 C2 37 4 40 6 40 C8 40 10 37 10 35 L10 20 C10 17 8 15 6 15 M4 22 L4 20 L5 20 L5 22 M7 22 L7 20 L8 20 L8 22" />
                </svg>
              </div>
            ))}

            {/* Blood Drops */}
            {[...Array(30)].map((_, i) => (
              <div
                key={i}
                className="absolute w-1 h-1 bg-red-600 rounded-full animate-pulse opacity-50"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                  animationDelay: `${Math.random() * 4}s`,
                  animationDuration: `${1 + Math.random() * 3}s`,
                }}
              />
            ))}

            {/* Thick Fog */}
            <div className="absolute bottom-0 left-0 w-full h-48 bg-gradient-to-t from-gray-900/40 to-transparent animate-pulse-slow opacity-70" />
          </div>

          {/* Red Lightning Effects */}
          <div
            className="absolute top-0 right-0 w-96 h-96 bg-gradient-radial from-red-600/20 to-transparent animate-ping opacity-40"
            style={{ animationDuration: "5s" }}
          />
          <div
            className="absolute bottom-0 left-0 w-80 h-80 bg-gradient-radial from-red-500/15 to-transparent animate-ping opacity-35"
            style={{ animationDuration: "7s", animationDelay: "2s" }}
          />
        </div>

        {/* Warning Content */}
        <div className="relative z-10 max-w-2xl mx-auto px-6 text-center animate-in fade-in duration-1000">
          <Card className="bg-black/90 border-red-900/50 backdrop-blur-xl shadow-2xl shadow-red-900/30">
            <CardContent className="p-12">
              {/* Disturbing Header */}
              <div className="mb-8">
                <div className="flex items-center justify-center gap-4 mb-6">
                  <div className="relative">
                    <AlertTriangle className="h-16 w-16 text-red-500 animate-pulse" />
                    <div className="absolute inset-0 h-16 w-16 text-red-500/30 animate-ping">
                      <AlertTriangle className="h-16 w-16" />
                    </div>
                  </div>
                </div>

                <h1 className="text-4xl font-bold bg-gradient-to-r from-red-600 via-red-400 to-red-600 bg-clip-text text-transparent tracking-wider mb-4 animate-pulse">
                  ADVERTENCIA
                </h1>

                <div className="h-1 w-32 bg-gradient-to-r from-red-600 to-red-400 mx-auto rounded-full shadow-lg shadow-red-500/50 animate-pulse" />
              </div>

              {/* Warning Text */}
              <div className="space-y-6 text-left">
                <div className="bg-red-900/20 border border-red-800/50 rounded-lg p-6 backdrop-blur-sm">
                  <div className="flex items-start gap-3 mb-4">
                    <Skull className="h-6 w-6 text-red-400 mt-1 flex-shrink-0" />
                    <h2 className="text-xl font-semibold text-red-300">Contenido Sensible</h2>
                  </div>
                  <p className="text-gray-300 leading-relaxed mb-4">
                    Esta galería puede contener imágenes de naturaleza perturbadora, violenta o psicológicamente
                    inquietante. El contenido está destinado únicamente para audiencias maduras.
                  </p>
                </div>

                <div className="bg-gray-900/40 border border-gray-700/50 rounded-lg p-6 backdrop-blur-sm">
                  <div className="flex items-start gap-3 mb-4">
                    <AlertTriangle className="h-6 w-6 text-yellow-400 mt-1 flex-shrink-0" />
                    <h2 className="text-xl font-semibold text-yellow-300">Galería Interactiva</h2>
                  </div>
                  <ul className="text-gray-300 space-y-2 text-sm leading-relaxed">
                    <li>• Galería colaborativa con sistema de likes y comentarios</li>
                    <li>• Categorías organizadas por tipo de horror</li>
                    <li>• Las imágenes subidas serán visibles para todos los usuarios</li>
                    <li>• Mantén el respeto hacia otros usuarios</li>
                  </ul>
                </div>

                <div className="bg-black/60 border border-red-900/30 rounded-lg p-6 backdrop-blur-sm">
                  <div className="flex items-start gap-3 mb-4">
                    <Skull className="h-6 w-6 text-red-500 mt-1 flex-shrink-0" />
                    <h2 className="text-xl font-semibold text-red-400">5.3.1 - Galería de Horror</h2>
                  </div>
                  <p className="text-gray-400 leading-relaxed text-sm">
                    Una colección colaborativa de imágenes oscuras y perturbadoras con funciones sociales. Al continuar,
                    usted acepta que es mayor de edad y comprende la naturaleza del contenido compartido.
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-4 mt-10">
                <Button
                  onClick={() => setShowIntro(false)}
                  className="flex-1 bg-gradient-to-r from-red-700 to-red-600 hover:from-red-800 hover:to-red-700 text-white font-medium py-4 rounded-lg shadow-lg shadow-red-900/30 hover:shadow-red-500/40 transition-all duration-300 transform hover:scale-[1.02]"
                >
                  <ArrowRight className="h-5 w-5 mr-2" />
                  Entrar a la Galería
                </Button>

                <Button
                  onClick={() => window.history.back()}
                  variant="outline"
                  className="flex-1 bg-gray-900/50 border-gray-600/50 text-gray-300 hover:bg-gray-800/70 hover:text-white font-medium py-4 rounded-lg transition-all duration-300"
                >
                  <X className="h-5 w-5 mr-2" />
                  Salir
                </Button>
              </div>

              {/* Footer Warning */}
              <div className="mt-8 pt-6 border-t border-red-900/30">
                <p className="text-xs text-gray-500 leading-relaxed">
                  Al continuar, confirma que es mayor de 18 años y acepta ver contenido de naturaleza perturbadora. Esta
                  aplicación no se hace responsable por cualquier impacto psicológico derivado del contenido
                  visualizado.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  // Main Gallery
  return (
    <div className="min-h-screen relative overflow-hidden bg-black">
      {/* Animated Horror Background */}
      <div className="fixed inset-0 bg-black">
        {/* Enhanced Horror Silhouettes */}
        <div className="absolute inset-0 overflow-hidden">
          {/* Twisted Dead Trees */}
          <div className="absolute bottom-0 left-10 w-32 h-64 opacity-20 animate-sway">
            <svg viewBox="0 0 100 200" className="w-full h-full fill-white">
              <path d="M50 200 L50 140 L45 130 L40 120 L35 110 L30 100 L25 90 L20 80 L15 70 L10 60 L5 50 L8 40 L12 30 L16 20 L20 10 L25 5 L30 2 L35 1 L40 0 L45 1 L50 2 L55 5 L60 10 L64 20 L68 30 L72 40 L75 50 L70 60 L65 70 L60 80 L55 90 L50 100 M25 85 L15 80 L5 75 L0 70 M75 85 L85 80 L95 75 L100 70 M30 120 L20 115 L10 110 L0 105 M70 120 L80 115 L90 110 L100 105" />
            </svg>
          </div>

          <div className="absolute bottom-0 right-20 w-28 h-56 opacity-15 animate-sway-reverse">
            <svg viewBox="0 0 100 200" className="w-full h-full fill-white">
              <path d="M50 200 L50 150 L48 140 L46 130 L44 120 L42 110 L40 100 L38 90 L36 80 L34 70 L32 60 L30 50 L28 40 L26 30 L24 20 L22 10 L25 5 L30 2 L35 1 L40 0 L45 1 L50 2 L55 5 L60 10 L58 20 L56 30 L54 40 L52 50 L50 60 M32 95 L22 90 L12 85 L2 80 M54 95 L64 90 L74 85 L84 80 M38 135 L28 130 L18 125 L8 120" />
            </svg>
          </div>

          {/* Sinister Castle */}
          <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-48 h-32 opacity-12 animate-pulse">
            <svg viewBox="0 0 200 100" className="w-full h-full fill-white">
              <path d="M0 100 L0 75 L15 75 L15 65 L25 65 L25 55 L35 55 L35 45 L45 45 L45 35 L55 35 L55 25 L65 25 L65 15 L75 15 L75 5 L85 5 L85 0 L95 0 L95 5 L105 5 L105 15 L115 15 L115 25 L125 25 L125 35 L135 35 L135 45 L145 45 L145 55 L155 55 L155 65 L165 65 L165 75 L180 75 L180 85 L190 85 L190 100 L200 100 L0 100" />
            </svg>
          </div>

          {/* Menacing Creatures */}
          {[...Array(10)].map((_, i) => (
            <div
              key={i}
              className="absolute animate-fly opacity-25"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${20 + Math.random() * 40}%`,
                animationDelay: `${Math.random() * 5}s`,
                animationDuration: `${3 + Math.random() * 4}s`,
              }}
            >
              <svg width="22" height="16" viewBox="0 0 24 16" className="fill-white">
                <path d="M12 8 L10 6 L8 4 L6 2 L4 1 L2 0 L0 1 L1 3 L3 5 L5 6 L7 7 L9 8 L12 9 L15 8 L17 7 L19 6 L21 5 L23 3 L24 1 L22 0 L20 1 L18 2 L16 4 L14 6 L12 8 M6 10 L4 12 L2 14 L0 16 M18 10 L20 12 L22 14 L24 16" />
              </svg>
            </div>
          ))}

          {/* Hanging Silhouettes */}
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="absolute animate-sway-disturbing opacity-8"
              style={{
                left: `${20 + i * 25}%`,
                top: `${8 + Math.random() * 12}%`,
                animationDelay: `${i * 2}s`,
                animationDuration: `${4 + i}s`,
              }}
            >
              <svg width="14" height="45" viewBox="0 0 14 45" className="fill-white">
                <path d="M7 0 L7 18 M7 18 C5 18 3 20 3 23 L3 38 C3 41 5 45 7 45 C9 45 11 41 11 38 L11 23 C11 20 9 18 7 18 M5 25 L5 23 L6 23 L6 25 M8 25 L8 23 L9 23 L9 25" />
              </svg>
            </div>
          ))}

          {/* Graveyard Crosses */}
          <div className="absolute bottom-0 left-1/4 w-8 h-20 opacity-25 animate-wobble">
            <svg viewBox="0 0 20 50" className="w-full h-full fill-white">
              <path d="M8 50 L8 15 L6 15 L6 10 L8 10 L8 5 L12 5 L12 10 L14 10 L14 15 L12 15 L12 50 L8 50 M6 8 L14 8 L14 12 L6 12 L6 8" />
            </svg>
          </div>

          <div className="absolute bottom-0 right-1/3 w-6 h-16 opacity-20 animate-wobble-reverse">
            <svg viewBox="0 0 20 50" className="w-full h-full fill-white">
              <path d="M9 50 L9 18 L7 18 L7 12 L9 12 L9 6 L11 6 L11 12 L13 12 L13 18 L11 18 L11 50 L9 50 M7 10 L13 10 L13 14 L7 14 L7 10" />
            </svg>
          </div>

          {/* Blood Particles */}
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              className="absolute w-1 h-1 bg-red-600 rounded-full animate-pulse opacity-60"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 3}s`,
                animationDuration: `${2 + Math.random() * 3}s`,
              }}
            />
          ))}

          {/* Fog Effect */}
          <div className="absolute bottom-0 left-0 w-full h-32 bg-gradient-to-t from-gray-900/25 to-transparent animate-pulse opacity-50" />
        </div>

        {/* Red Lightning Effects */}
        <div
          className="absolute top-0 right-0 w-64 h-64 bg-gradient-radial from-red-600/12 to-transparent animate-ping opacity-60"
          style={{ animationDuration: "4s" }}
        />
        <div
          className="absolute bottom-0 left-0 w-48 h-48 bg-gradient-radial from-red-500/10 to-transparent animate-ping opacity-50"
          style={{ animationDuration: "6s", animationDelay: "2s" }}
        />
      </div>

      {/* Main Content */}
      <div className="relative z-10 container mx-auto px-4 py-12">
        {/* Horror Header */}
        <div className="text-center mb-16">
          <div className="flex items-center justify-center gap-4 mb-6">
            <div className="relative">
              <Skull className="h-12 w-12 text-red-500 animate-pulse" />
              <div className="absolute inset-0 h-12 w-12 text-red-500/30 animate-ping">
                <Skull className="h-12 w-12" />
              </div>
            </div>
            <div className="text-center">
              <h1 className="text-6xl font-bold bg-gradient-to-r from-red-600 via-red-400 to-red-600 bg-clip-text text-transparent tracking-wider drop-shadow-2xl">
                5.3.1
              </h1>
              <div className="h-1 w-24 bg-gradient-to-r from-red-600 to-red-400 mx-auto mt-2 rounded-full shadow-lg shadow-red-500/50" />
            </div>
            <div className="relative">
              <Skull className="h-12 w-12 text-red-500 animate-pulse scale-x-[-1]" />
              <div className="absolute inset-0 h-12 w-12 text-red-500/30 animate-ping scale-x-[-1]">
                <Skull className="h-12 w-12" />
              </div>
            </div>
          </div>
          <p className="text-xl text-red-300 font-light tracking-wide mb-2 drop-shadow-lg">
            GALERÍA INTERACTIVA DE HORROR
          </p>
          <p className="text-gray-400 max-w-2xl mx-auto leading-relaxed">
            Explora, comenta y da like a nuestra colección colaborativa de imágenes oscuras y terroríficas
          </p>
        </div>

        <div className="grid xl:grid-cols-4 gap-8">
          {/* Upload Form */}
          <div className="xl:col-span-1">
            <Card className="bg-black/80 border-red-900/50 backdrop-blur-xl shadow-2xl shadow-red-900/20 hover:shadow-red-500/20 transition-all duration-500">
              <CardHeader className="pb-4">
                <CardTitle className="text-white flex items-center gap-3 text-xl">
                  <div className="p-2 bg-red-600/20 rounded-lg border border-red-500/30">
                    <Upload className="h-5 w-5 text-red-400" />
                  </div>
                  Subir Imagen
                </CardTitle>
                <CardDescription className="text-gray-400 leading-relaxed">
                  Comparte tu contenido oscuro con la comunidad
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="photo-upload" className="text-gray-300 font-medium">
                      Seleccionar Archivo de Imagen
                    </Label>
                    <div className="relative">
                      <div className="flex items-center justify-center w-full">
                        <label
                          htmlFor="photo-upload"
                          className="flex flex-col items-center justify-center w-full h-32 border-2 border-red-900/50 border-dashed rounded-lg cursor-pointer bg-gray-900/50 hover:bg-gray-800/50 hover:border-red-500/50 transition-all duration-300"
                        >
                          <div className="flex flex-col items-center justify-center pt-5 pb-6">
                            <Upload className="w-8 h-8 mb-4 text-red-400" />
                            <p className="mb-2 text-sm text-gray-300">
                              <span className="font-semibold">Haz clic para subir</span> o arrastra y suelta
                            </p>
                            <p className="text-xs text-gray-500">PNG, JPG, GIF hasta 10MB</p>
                            {formData.file && (
                              <p className="text-xs text-red-400 mt-2 font-medium">
                                Archivo seleccionado: {formData.file.name}
                              </p>
                            )}
                          </div>
                          <input
                            id="photo-upload"
                            type="file"
                            accept="image/*"
                            onChange={handleFileChange}
                            className="hidden"
                            required
                            disabled={uploading}
                          />
                        </label>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="name" className="text-gray-300 font-medium">
                      Título
                    </Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                      placeholder="Ingresa un título siniestro..."
                      className="bg-gray-900/80 border-red-900/50 text-white placeholder:text-gray-500 focus:border-red-500/50 focus:ring-red-500/20 transition-all duration-300"
                      required
                      disabled={uploading}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="category" className="text-gray-300 font-medium">
                      Categoría
                    </Label>
                    <Select
                      value={formData.category}
                      onValueChange={(value) => setFormData((prev) => ({ ...prev, category: value }))}
                      disabled={uploading}
                    >
                      <SelectTrigger className="bg-gray-900/80 border-red-900/50 text-white focus:border-red-500/50 focus:ring-red-500/20">
                        <SelectValue placeholder="Selecciona una categoría" />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-900 border-red-900/50">
                        {HORROR_CATEGORIES.map((category) => (
                          <SelectItem
                            key={category.value}
                            value={category.value}
                            className="text-white hover:bg-red-900/20"
                          >
                            <span className="flex items-center gap-2">
                              <span>{category.icon}</span>
                              {category.label}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="tags" className="text-gray-300 font-medium">
                      Etiquetas
                    </Label>
                    <Input
                      id="tags"
                      value={formData.tags}
                      onChange={(e) => setFormData((prev) => ({ ...prev, tags: e.target.value }))}
                      placeholder="terror, miedo, oscuridad..."
                      className="bg-gray-900/80 border-red-900/50 text-white placeholder:text-gray-500 focus:border-red-500/50 focus:ring-red-500/20 transition-all duration-300"
                      disabled={uploading}
                    />
                    <p className="text-xs text-gray-500">Separa las etiquetas con comas</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description" className="text-gray-300 font-medium">
                      Descripción
                    </Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                      placeholder="Describe el horror que contiene..."
                      className="bg-gray-900/80 border-red-900/50 text-white placeholder:text-gray-500 focus:border-red-500/50 focus:ring-red-500/20 transition-all duration-300 resize-none"
                      rows={4}
                      disabled={uploading}
                    />
                  </div>

                  <Button
                    type="submit"
                    className="w-full bg-gradient-to-r from-red-700 to-red-600 hover:from-red-800 hover:to-red-700 text-white font-medium py-3 rounded-lg shadow-lg shadow-red-900/30 hover:shadow-red-500/40 transition-all duration-300 transform hover:scale-[1.02]"
                    disabled={!formData.file || !formData.name || uploading}
                  >
                    {uploading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Subiendo...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-2" />
                        Subir a la Galería
                      </>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Stats Card */}
            <Card className="bg-black/80 border-red-900/50 backdrop-blur-xl shadow-2xl shadow-red-900/20 mt-6 hover:shadow-red-500/20 transition-all duration-500">
              <CardContent className="pt-6">
                <div className="text-center space-y-4">
                  <div className="relative">
                    <div className="text-4xl font-bold bg-gradient-to-r from-red-500 to-red-400 bg-clip-text text-transparent drop-shadow-lg">
                      {photos.length}
                    </div>
                    <div className="absolute inset-0 text-4xl font-bold text-red-400/20 animate-pulse">
                      {photos.length}
                    </div>
                  </div>
                  <div className="text-gray-300 text-sm font-medium tracking-wide">
                    {photos.length === 1 ? "Alma Capturada" : "Almas Capturadas"}
                  </div>
                  <div className="flex items-center justify-center gap-2 text-xs text-gray-500">
                    <Heart className="h-3 w-3 text-red-500" />
                    <span>{photos.reduce((sum, photo) => sum + (photo.likes_count || 0), 0)} Likes Totales</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Gallery */}
          <div className="xl:col-span-3">
            {/* Search and Filters */}
            <div className="mb-8 space-y-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                  <Input
                    placeholder="Buscar en la oscuridad..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-12 pr-4 py-3 bg-black/80 border-red-900/50 text-white placeholder:text-gray-500 focus:border-red-500/50 focus:ring-red-500/20 backdrop-blur-xl rounded-lg transition-all duration-300"
                  />
                </div>

                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger className="w-full sm:w-48 bg-black/80 border-red-900/50 text-white focus:border-red-500/50 focus:ring-red-500/20">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Categoría" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-900 border-red-900/50">
                    <SelectItem value="all" className="text-white hover:bg-red-900/20">
                      Todas las categorías
                    </SelectItem>
                    {HORROR_CATEGORIES.map((category) => (
                      <SelectItem
                        key={category.value}
                        value={category.value}
                        className="text-white hover:bg-red-900/20"
                      >
                        <span className="flex items-center gap-2">
                          <span>{category.icon}</span>
                          {category.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-full sm:w-48 bg-black/80 border-red-900/50 text-white focus:border-red-500/50 focus:ring-red-500/20">
                    <SelectValue placeholder="Ordenar" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-900 border-red-900/50">
                    <SelectItem value="newest" className="text-white hover:bg-red-900/20">
                      Más recientes
                    </SelectItem>
                    <SelectItem value="oldest" className="text-white hover:bg-red-900/20">
                      Más antiguos
                    </SelectItem>
                    <SelectItem value="likes" className="text-white hover:bg-red-900/20">
                      Más populares
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Loading State */}
            {loading && (
              <Card className="bg-black/80 border-red-900/50 backdrop-blur-xl shadow-2xl shadow-red-900/20">
                <CardContent className="pt-16 pb-16 text-center">
                  <Loader2 className="h-12 w-12 text-red-500 mx-auto animate-spin mb-4" />
                  <p className="text-gray-300">Cargando almas desde las sombras...</p>
                </CardContent>
              </Card>
            )}

            {/* Photo Grid */}
            {!loading && filteredAndSortedPhotos.length === 0 ? (
              <Card className="bg-black/80 border-red-900/50 backdrop-blur-xl shadow-2xl shadow-red-900/20">
                <CardContent className="pt-16 pb-16 text-center">
                  <div className="relative mb-6">
                    <Skull className="h-20 w-20 text-gray-600 mx-auto animate-pulse" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div
                        className="w-24 h-24 border-2 border-red-600/30 rounded-full animate-spin"
                        style={{ animationDuration: "3s" }}
                      />
                    </div>
                  </div>
                  <h3 className="text-xl font-semibold text-gray-300 mb-2">
                    {photos.length === 0 ? "El Vacío Aguarda" : "Nada Encontrado en la Oscuridad"}
                  </h3>
                  <p className="text-gray-500 max-w-md mx-auto leading-relaxed">
                    {photos.length === 0
                      ? "Sé el primero en compartir una imagen inquietante con la comunidad"
                      : "Las sombras ocultan lo que buscas. Prueba con diferentes palabras para revelar lo oculto"}
                  </p>
                </CardContent>
              </Card>
            ) : (
              !loading && (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredAndSortedPhotos.map((photo, index) => (
                    <Card
                      key={photo.id}
                      className="bg-black/80 border-red-900/50 backdrop-blur-xl shadow-2xl shadow-red-900/20 hover:shadow-red-500/30 transition-all duration-500 group hover:scale-[1.02] hover:border-red-500/50"
                      style={{ animationDelay: `${index * 100}ms` }}
                    >
                      <CardContent className="p-0">
                        <div className="relative aspect-[4/3] overflow-hidden rounded-t-lg">
                          <Image
                            src={photo.image_url || "/placeholder.svg"}
                            alt={photo.name}
                            fill
                            className="object-cover group-hover:scale-110 transition-transform duration-700"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                          {/* Action buttons */}
                          <div className="absolute top-3 right-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-2 group-hover:translate-y-0">
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => setSelectedPhoto(photo)}
                              className="bg-black/80 hover:bg-black/90 text-white border-red-500/30 backdrop-blur-sm shadow-lg hover:shadow-red-500/25 transition-all duration-300"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => deletePhoto(photo)}
                              className="bg-red-700/80 hover:bg-red-600 border-0 backdrop-blur-sm shadow-lg hover:shadow-red-500/25 transition-all duration-300"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>

                          {/* Category Badge - only show if category exists */}
                          {photo.category && (
                            <div className="absolute top-3 left-3 opacity-0 group-hover:opacity-100 transition-all duration-300">
                              <Badge className="bg-black/80 text-red-300 border-red-500/30 backdrop-blur-sm">
                                {HORROR_CATEGORIES.find((cat) => cat.value === photo.category)?.icon}{" "}
                                {HORROR_CATEGORIES.find((cat) => cat.value === photo.category)?.label}
                              </Badge>
                            </div>
                          )}

                          {/* Overlay info - only title */}
                          <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/90 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                            <h3 className="text-white font-semibold text-lg mb-1 line-clamp-1">{photo.name}</h3>
                            <p className="text-gray-400 text-sm">Haz clic para ver detalles</p>
                          </div>
                        </div>

                        <div className="p-5">
                          <h3 className="text-white font-semibold text-lg mb-3 line-clamp-1">{photo.name}</h3>

                          {/* Tags - only show if tags exist */}
                          {photo.tags && photo.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mb-3">
                              {photo.tags.slice(0, 3).map((tag, tagIndex) => (
                                <Badge
                                  key={tagIndex}
                                  variant="outline"
                                  className="text-xs bg-red-900/20 text-red-300 border-red-800/50"
                                >
                                  <Tag className="h-3 w-3 mr-1" />
                                  {tag}
                                </Badge>
                              ))}
                              {photo.tags.length > 3 && (
                                <Badge
                                  variant="outline"
                                  className="text-xs bg-gray-900/20 text-gray-400 border-gray-700/50"
                                >
                                  +{photo.tags.length - 3}
                                </Badge>
                              )}
                            </div>
                          )}

                          <div className="flex justify-between items-center">
                            <Badge
                              variant="secondary"
                              className="bg-red-900/40 text-red-300 border-red-800/50 backdrop-blur-sm"
                            >
                              {new Date(photo.created_at).toLocaleDateString()}
                            </Badge>

                            {/* Like button - only show if likes_count exists */}
                            {typeof photo.likes_count === "number" && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => toggleLike(photo)}
                                className={`text-sm ${
                                  likedPhotos.has(photo.id)
                                    ? "text-red-400 hover:text-red-300"
                                    : "text-gray-400 hover:text-red-400"
                                } transition-colors duration-300`}
                              >
                                <Heart className={`h-4 w-4 mr-1 ${likedPhotos.has(photo.id) ? "fill-current" : ""}`} />
                                {photo.likes_count}
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )
            )}
          </div>
        </div>

        {/* Enhanced Photo Modal with Comments */}
        {selectedPhoto && (
          <div
            className="fixed inset-0 bg-black/95 backdrop-blur-xl z-50 flex items-center justify-center p-4 animate-in fade-in duration-300"
            onClick={() => setSelectedPhoto(null)}
          >
            <Card className="bg-black/90 border-red-900/50 max-w-6xl w-full max-h-[95vh] overflow-hidden backdrop-blur-xl shadow-2xl shadow-red-900/30 animate-in zoom-in-95 duration-300">
              <CardContent className="p-0 flex flex-col h-full">
                {/* Image Section */}
                <div className="relative flex-shrink-0" style={{ height: "50vh" }}>
                  <Image
                    src={selectedPhoto.image_url || "/placeholder.svg"}
                    alt={selectedPhoto.name}
                    fill
                    className="object-contain"
                  />
                  <Button
                    variant="destructive"
                    size="sm"
                    className="absolute top-4 right-4 bg-red-700/80 hover:bg-red-600 backdrop-blur-sm shadow-lg z-10"
                    onClick={(e) => {
                      e.stopPropagation()
                      setSelectedPhoto(null)
                    }}
                  >
                    ✕
                  </Button>

                  {/* Like button on image - only show if likes_count exists */}
                  {typeof selectedPhoto.likes_count === "number" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation()
                        toggleLike(selectedPhoto)
                      }}
                      className={`absolute top-4 left-4 ${
                        likedPhotos.has(selectedPhoto.id) ? "text-red-400 bg-red-900/20" : "text-gray-400 bg-black/50"
                      } backdrop-blur-sm hover:bg-red-900/30 transition-all duration-300`}
                    >
                      <Heart className={`h-5 w-5 mr-2 ${likedPhotos.has(selectedPhoto.id) ? "fill-current" : ""}`} />
                      {selectedPhoto.likes_count}
                    </Button>
                  )}
                </div>

                {/* Content Section - Below Image */}
                <div className="flex-1 min-h-0 flex">
                  {/* Left: Info and Description */}
                  <div className="flex-1 p-8 overflow-y-auto custom-scrollbar">
                    {/* Title and Meta */}
                    <div className="mb-6">
                      <h2 className="text-3xl font-bold text-white mb-3 leading-tight">{selectedPhoto.name}</h2>
                      <div className="flex items-center gap-4 mb-4">
                        <Badge
                          variant="secondary"
                          className="bg-red-900/40 text-red-300 border-red-800/50 backdrop-blur-sm px-4 py-2"
                        >
                          Capturada el {new Date(selectedPhoto.created_at).toLocaleDateString()}
                        </Badge>
                        {selectedPhoto.category && (
                          <Badge className="bg-black/60 text-red-300 border-red-500/30">
                            {HORROR_CATEGORIES.find((cat) => cat.value === selectedPhoto.category)?.icon}{" "}
                            {HORROR_CATEGORIES.find((cat) => cat.value === selectedPhoto.category)?.label}
                          </Badge>
                        )}
                      </div>

                      {/* Tags */}
                      {selectedPhoto.tags && selectedPhoto.tags.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-4">
                          {selectedPhoto.tags.map((tag, tagIndex) => (
                            <Badge
                              key={tagIndex}
                              variant="outline"
                              className="bg-red-900/20 text-red-300 border-red-800/50"
                            >
                              <Tag className="h-3 w-3 mr-1" />
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Description Section */}
                    {selectedPhoto.description ? (
                      <div className="mb-6">
                        <div className="mb-4">
                          <h3 className="text-lg font-semibold text-red-300 flex items-center gap-2">
                            <Skull className="h-5 w-5" />
                            Descripción
                          </h3>
                          <div className="h-px bg-gradient-to-r from-red-600/50 to-transparent mt-2" />
                        </div>

                        <div className="bg-gray-900/30 border border-red-900/30 rounded-lg p-6 backdrop-blur-sm">
                          <p className="text-gray-300 leading-relaxed text-base whitespace-pre-wrap">
                            {selectedPhoto.description}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-8 mb-6">
                        <Skull className="h-12 w-12 text-gray-600 mx-auto mb-3 opacity-50" />
                        <p className="text-gray-500 text-sm">Sin descripción disponible</p>
                      </div>
                    )}
                  </div>

                  {/* Right: Comments Section */}
                  <div className="w-80 border-l border-red-900/30 flex flex-col">
                    <div className="p-6 border-b border-red-900/30">
                      <h3 className="text-lg font-semibold text-red-300 flex items-center gap-2">
                        <MessageCircle className="h-5 w-5" />
                        Comentarios ({comments.length})
                      </h3>
                    </div>

                    {/* Comments List */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
                      {comments.length === 0 ? (
                        <div className="text-center py-8">
                          <MessageCircle className="h-12 w-12 text-gray-600 mx-auto mb-3 opacity-50" />
                          <p className="text-gray-500 text-sm">No hay comentarios aún</p>
                          <p className="text-gray-600 text-xs mt-1">Sé el primero en comentar</p>
                        </div>
                      ) : (
                        comments.map((comment) => (
                          <div
                            key={comment.id}
                            className="bg-gray-900/30 border border-red-900/20 rounded-lg p-4 backdrop-blur-sm"
                          >
                            <div className="flex items-center gap-2 mb-2">
                              <div className="w-6 h-6 bg-red-600/20 rounded-full flex items-center justify-center">
                                <span className="text-xs text-red-400 font-bold">
                                  {comment.user_name.charAt(0).toUpperCase()}
                                </span>
                              </div>
                              <span className="text-red-300 font-medium text-sm">{comment.user_name}</span>
                              <span className="text-gray-500 text-xs ml-auto">
                                {new Date(comment.created_at).toLocaleDateString()}
                              </span>
                            </div>
                            <p className="text-gray-300 text-sm leading-relaxed">{comment.comment}</p>
                          </div>
                        ))
                      )}
                    </div>

                    {/* Add Comment Form */}
                    <div className="p-4 border-t border-red-900/30 space-y-3">
                      {!userName && (
                        <Input
                          placeholder="Tu nombre..."
                          value={userName}
                          onChange={(e) => setUserName(e.target.value)}
                          className="bg-gray-900/80 border-red-900/50 text-white placeholder:text-gray-500 focus:border-red-500/50 focus:ring-red-500/20 text-sm"
                        />
                      )}
                      <div className="flex gap-2">
                        <Textarea
                          placeholder="Añade un comentario..."
                          value={newComment}
                          onChange={(e) => setNewComment(e.target.value)}
                          className="bg-gray-900/80 border-red-900/50 text-white placeholder:text-gray-500 focus:border-red-500/50 focus:ring-red-500/20 resize-none text-sm"
                          rows={2}
                        />
                        <Button
                          size="sm"
                          onClick={addComment}
                          disabled={!newComment.trim() || !userName.trim()}
                          className="bg-red-700/80 hover:bg-red-600 text-white px-3 self-end"
                        >
                          <Send className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}
