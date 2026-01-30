import { ExternalLink, Book, MessageCircle, FileText, Video, Mail } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const resources = [
  {
    title: "Documentation",
    description: "Comprehensive guides and API reference",
    icon: Book,
    href: "#",
  },
  {
    title: "Video Tutorials",
    description: "Step-by-step video walkthroughs",
    icon: Video,
    href: "#",
  },
  {
    title: "API Reference",
    description: "Complete API documentation",
    icon: FileText,
    href: "#",
  },
  {
    title: "Community Forum",
    description: "Connect with other users",
    icon: MessageCircle,
    href: "#",
  },
];

const faqs = [
  {
    question: "How do I upload training data?",
    answer: "Navigate to your project, go to the Data step, and use the drag-and-drop upload zone to add your files. Supported formats include images, video, audio, text, and CSV files.",
  },
  {
    question: "What file formats are supported?",
    answer: "We support JPEG, PNG, and WebP for images; MP4 and WebM for video; MP3 and WAV for audio; TXT and JSON for text; and CSV for tabular data.",
  },
  {
    question: "How long does model training take?",
    answer: "Training time varies based on dataset size and model complexity. Most models train within 5-30 minutes. Large datasets may take longer.",
  },
  {
    question: "Can I export my trained model?",
    answer: "Yes! You can deploy models as cloud REST APIs or export optimized versions for edge devices and on-premise deployment.",
  },
];

export default function Help() {
  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6" data-testid="help-page">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Help & Resources</h1>
        <p className="text-muted-foreground">
          Find answers and learn how to get the most out of MLForge
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {resources.map((resource) => (
          <Card key={resource.title} className="hover-elevate cursor-pointer" data-testid={`resource-${resource.title.toLowerCase().replace(/\s+/g, '-')}`}>
            <CardContent className="p-5">
              <div className="flex items-start gap-4">
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 shrink-0">
                  <resource.icon className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-foreground">{resource.title}</h3>
                    <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
                  </div>
                  <p className="text-sm text-muted-foreground">{resource.description}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Frequently Asked Questions</CardTitle>
          <CardDescription>Quick answers to common questions</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {faqs.map((faq, index) => (
            <div key={index} className="pb-4 border-b border-border last:border-0 last:pb-0" data-testid={`faq-${index}`}>
              <h4 className="font-medium text-foreground mb-1">{faq.question}</h4>
              <p className="text-sm text-muted-foreground">{faq.answer}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Contact Support</CardTitle>
          <CardDescription>Need more help? Our team is here for you</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 flex-wrap">
            <Button className="gap-2" data-testid="button-contact-support">
              <Mail className="w-4 h-4" />
              Contact Support
            </Button>
            <p className="text-sm text-muted-foreground">
              Average response time: 2-4 hours
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
